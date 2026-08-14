"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { postMessage } from "@/services/messages";
import { assignTicket, updateTicketStatus } from "@/services/tickets";
import { enqueue, QUEUE } from "@/lib/queue";
import { db } from "@/db/client";
import {
  users,
  tickets as ticketsTable,
  ticketMessages as ticketMessagesTable,
} from "@/db/schema";
import { eq } from "drizzle-orm";

const replySchema = z.object({
  ticketId: z.uuid(),
  body: z.string().min(1).max(20_000),
  internal: z.boolean(),
});

export async function sendReply(input: {
  ticketId: string;
  body: string;
  internal: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada — entre de novo." };

  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Mensagem inválida." };

  const result = await postMessage(actor, parsed.data);
  if (!result.ok) return { ok: false, error: "Não deu para enviar agora." };

  const { ticket, message } = result.value;

  // Resposta pública em chamado de WhatsApp sai também pelo canal de origem.
  if (!parsed.data.internal && ticket.origin === "whatsapp") {
    await db
      .update(ticketMessagesTable)
      .set({ delivery: { channel: "whatsapp", status: "queued" } })
      .where(eq(ticketMessagesTable.id, message.id));
    await enqueue(
      QUEUE.whatsappSend,
      { ticketMessageId: message.id },
      { retryLimit: 5, retryBackoff: true },
    );
  }

  // Autor externo com e-mail real também recebe por e-mail.
  if (!parsed.data.internal && ticket.authorId !== actor.id) {
    const author = await db.query.users.findFirst({
      where: eq(users.id, ticket.authorId),
    });
    if (author && !author.email.endsWith("@wa.invalid")) {
      // Fila com retry: o e-mail falhar não desfaz a mensagem.
      await enqueue(
        QUEUE.email,
        {
          to: author.email,
          subject: `Resposta ao seu chamado — ${ticket.title}`,
          text: `${parsed.data.body}\n\n—\nVocê pode acompanhar em ${process.env.BETTER_AUTH_URL ?? ""}/meus-chamados`,
        },
        { retryLimit: 5, retryBackoff: true },
      );
    }
  }

  const [t] = await db
    .select({ number: ticketsTable.number })
    .from(ticketsTable)
    .where(eq(ticketsTable.id, ticket.id));
  if (t) revalidatePath(`/tickets/${t.number}`);
  return { ok: true };
}

const taskFromTicketSchema = z.object({ ticketId: z.uuid() });

/**
 * Gera uma task interna a partir de um chamado: o chamado segue sendo a
 * conversa com quem abriu; a task é o trabalho do time, ligada a ele.
 */
export async function createTaskFromTicket(input: {
  ticketId: string;
}): Promise<{ ok: boolean; number?: number; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada." };
  const parsed = taskFromTicketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Chamado inválido." };

  const source = await db.query.tickets.findFirst({
    where: eq(ticketsTable.id, parsed.data.ticketId),
  });
  if (!source || source.type === "task") {
    return { ok: false, error: "Chamado não encontrado." };
  }

  const { createTicket } = await import("@/services/tickets");
  const { formatTicketRef } = await import("@/lib/format");
  const sourceRef = formatTicketRef(source.number);

  const result = await createTicket(actor, {
    projectId: source.projectId,
    type: "task",
    title: source.title,
    body: `Task gerada a partir do chamado ${sourceRef}.\n\n---\n\n${source.body}`,
    priority: source.priority,
    origin: "internal",
    externalRef: `ticket:${source.id}`,
  });
  if (!result.ok) return { ok: false, error: "Não deu para criar a task." };

  // Registro no chamado, invisível para quem abriu
  await postMessage(actor, {
    ticketId: source.id,
    body: `Task ${formatTicketRef(result.value.number)} criada a partir deste chamado.`,
    internal: true,
  });

  revalidatePath(`/tickets/${source.number}`);
  return { ok: true, number: result.value.number };
}

const assignSchema = z.object({
  ticketId: z.uuid(),
  assigneeId: z.string().nullable(),
  ticketNumber: z.number(),
});

export async function assign(input: {
  ticketId: string;
  assigneeId: string | null;
  ticketNumber: number;
}): Promise<{ ok: boolean }> {
  const actor = await getActor();
  if (!actor) return { ok: false };
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const result = await assignTicket(actor, parsed.data.ticketId, parsed.data.assigneeId);
  revalidatePath(`/tickets/${parsed.data.ticketNumber}`);
  revalidatePath("/");
  return { ok: result.ok };
}

const statusSchema = z.object({
  ticketId: z.uuid(),
  status: z.enum([
    "open",
    "in_analysis",
    "waiting_author",
    "in_review",
    "resolved",
    "closed",
  ]),
  ticketNumber: z.number(),
});

export async function setStatus(input: {
  ticketId: string;
  status:
    | "open"
    | "in_analysis"
    | "waiting_author"
    | "in_review"
    | "resolved"
    | "closed";
  ticketNumber: number;
}): Promise<{ ok: boolean }> {
  const actor = await getActor();
  if (!actor) return { ok: false };
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const result = await updateTicketStatus(
    actor,
    parsed.data.ticketId,
    parsed.data.status,
  );
  revalidatePath(`/tickets/${parsed.data.ticketNumber}`);
  revalidatePath("/");
  return { ok: result.ok };
}
