import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  users,
  projects,
  projectMembers,
  tickets,
  ticketMessages,
  whatsappContacts,
} from "@/db/schema";
import { getEnv } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { sendWhatsappText } from "@/lib/whatsapp/client";
import { enqueue, QUEUE } from "@/lib/queue";
import type { Logger } from "@/lib/logger";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function windowState(lastInboundAt: Date | null): {
  open: boolean;
  closesAt: Date | null;
} {
  if (!lastInboundAt) return { open: false, closesAt: null };
  const closesAt = new Date(lastInboundAt.getTime() + WINDOW_MS);
  return { open: closesAt.getTime() > Date.now(), closesAt };
}

/**
 * Processa uma mensagem recebida. Idempotente em três camadas:
 * o webhook responde 200 na hora, o enqueue usa singletonKey por message_id,
 * e o insert da mensagem tem unique(external_id) + onConflictDoNothing.
 */
export async function processInbound(
  input: { messageId: string; from: string; text: string; timestamp: number },
  log: Logger,
): Promise<void> {
  const phone = input.from.replace(/\D/g, "");

  // Já processada? (re-entrega da Meta)
  const existing = await db.query.ticketMessages.findFirst({
    where: eq(ticketMessages.externalId, input.messageId),
  });
  if (existing) {
    log.info("mensagem já processada, ignorando re-entrega", {
      messageId: input.messageId,
    });
    return;
  }

  let contact = await db.query.whatsappContacts.findFirst({
    where: eq(whatsappContacts.phone, phone),
  });

  if (!contact) {
    // Telefone desconhecido: guest provisório no projeto configurado.
    const slug = getEnv().WHATSAPP_DEFAULT_PROJECT_SLUG;
    if (!slug) {
      log.warn("telefone desconhecido e WHATSAPP_DEFAULT_PROJECT_SLUG ausente", { phone });
      return;
    }
    const project = await db.query.projects.findFirst({
      where: eq(projects.slug, slug),
    });
    if (!project) {
      log.error("projeto padrão do whatsapp não existe", { slug });
      return;
    }

    const userId = `wa-${phone}`;
    await db
      .insert(users)
      .values({
        id: userId,
        name: `WhatsApp +${phone}`,
        email: `+${phone}@wa.invalid`,
        role: "guest",
        emailVerified: false,
      })
      .onConflictDoNothing();
    await db
      .insert(projectMembers)
      .values({ projectId: project.id, userId, role: "collaborator" })
      .onConflictDoNothing();
    const [created] = await db
      .insert(whatsappContacts)
      .values({ phone, userId, projectId: project.id })
      .onConflictDoNothing()
      .returning();
    contact =
      created ??
      (await db.query.whatsappContacts.findFirst({
        where: eq(whatsappContacts.phone, phone),
      }));
    if (!contact) return;
    log.info("guest provisório criado para telefone desconhecido", { phone });
  }

  await db
    .update(whatsappContacts)
    .set({ lastInboundAt: new Date(input.timestamp * 1000) })
    .where(eq(whatsappContacts.id, contact.id));

  // Chamado aberto deste contato? Anexa; senão, abre um novo.
  const openTicket = await db.query.tickets.findFirst({
    where: and(
      eq(tickets.authorId, contact.userId),
      eq(tickets.projectId, contact.projectId),
      eq(tickets.origin, "whatsapp"),
      inArray(tickets.status, ["open", "in_analysis", "waiting_author", "in_review"]),
    ),
    orderBy: [desc(tickets.createdAt)],
  });

  if (openTicket) {
    const [inserted] = await db
      .insert(ticketMessages)
      .values({
        ticketId: openTicket.id,
        authorId: contact.userId,
        body: input.text,
        internal: false,
        externalId: input.messageId,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      await db
        .update(tickets)
        .set({ updatedAt: new Date() })
        .where(eq(tickets.id, openTicket.id));
      log.info("mensagem anexada a chamado aberto", { ticketId: openTicket.id });
    }
    return;
  }

  const title =
    input.text.length > 80 ? `${input.text.slice(0, 77)}…` : input.text;
  const [ticket] = await db
    .insert(tickets)
    .values({
      projectId: contact.projectId,
      type: "support",
      title,
      body: input.text,
      origin: "whatsapp",
      externalRef: `wa:${phone}`,
      authorId: contact.userId,
    })
    .returning();
  if (!ticket) return;

  // A primeira mensagem também fica na thread com o external_id — é ela que
  // garante a idempotência se a Meta reenviar depois do ticket criado.
  await db
    .insert(ticketMessages)
    .values({
      ticketId: ticket.id,
      authorId: contact.userId,
      body: input.text,
      internal: false,
      externalId: input.messageId,
    })
    .onConflictDoNothing();

  await logAudit({
    actorKind: "system",
    action: "ticket.create",
    entityType: "ticket",
    entityId: ticket.id,
    metadata: { origin: "whatsapp" },
  });

  await enqueue(
    QUEUE.triage,
    { ticketId: ticket.id, correlationId: log.correlationId },
    { retryLimit: 3, retryBackoff: true },
  );
  log.info("chamado criado a partir do whatsapp", { ticketId: ticket.id });
}

/** Envia a resposta do time; registra explicitamente quando a janela fechou. */
export async function deliverWhatsappMessage(
  ticketMessageId: string,
  log: Logger,
): Promise<void> {
  const message = await db.query.ticketMessages.findFirst({
    where: eq(ticketMessages.id, ticketMessageId),
  });
  if (!message || message.internal) return;

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, message.ticketId),
  });
  if (!ticket || ticket.origin !== "whatsapp" || !ticket.externalRef) return;

  const phone = ticket.externalRef.replace(/^wa:/, "");
  const contact = await db.query.whatsappContacts.findFirst({
    where: eq(whatsappContacts.phone, phone),
  });

  const { open } = windowState(contact?.lastInboundAt ?? null);
  if (!open) {
    await db
      .update(ticketMessages)
      .set({ delivery: { channel: "whatsapp", status: "window_closed" } })
      .where(eq(ticketMessages.id, ticketMessageId));
    log.warn("janela de 24h fechada — mensagem não enviada por whatsapp", {
      ticketMessageId,
    });
    return; // explícito, nunca falha em silêncio; a UI mostra o estado
  }

  const result = await sendWhatsappText(phone, message.body);
  if (!result.ok) {
    await db
      .update(ticketMessages)
      .set({
        delivery: {
          channel: "whatsapp",
          status: result.error === "window_closed" ? "window_closed" : "failed",
          error: result.message,
        },
      })
      .where(eq(ticketMessages.id, ticketMessageId));
    if (result.error === "window_closed") return;
    throw new Error(`envio whatsapp falhou: ${result.message}`);
  }

  await db
    .update(ticketMessages)
    .set({
      delivery: {
        channel: "whatsapp",
        status: "sent",
        waMessageId: result.value.waMessageId,
      },
    })
    .where(eq(ticketMessages.id, ticketMessageId));
  log.info("resposta enviada por whatsapp", { ticketMessageId });
}
