"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { postMessage } from "@/services/messages";
import { assignTicket, updateTicketStatus } from "@/services/tickets";
import { sendEmail } from "@/lib/email/mailer";
import { db } from "@/db/client";
import { users, tickets as ticketsTable } from "@/db/schema";
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

  // Resposta pública a autor externo sai por e-mail (WhatsApp entra na etapa do canal).
  const { ticket } = result.value;
  if (!parsed.data.internal && ticket.authorId !== actor.id) {
    const author = await db.query.users.findFirst({
      where: eq(users.id, ticket.authorId),
    });
    if (author && !author.email.endsWith("@wa.invalid")) {
      await sendEmail({
        to: author.email,
        subject: `Resposta ao seu chamado — ${ticket.title}`,
        text: `${parsed.data.body}\n\n—\nVocê pode acompanhar em ${process.env.BETTER_AUTH_URL ?? ""}/meus-chamados`,
      }).catch(() => {
        /* o e-mail falhar não desfaz a mensagem; a fila da etapa 6 traz retry */
      });
    }
  }

  const [t] = await db
    .select({ number: ticketsTable.number })
    .from(ticketsTable)
    .where(eq(ticketsTable.id, ticket.id));
  if (t) revalidatePath(`/tickets/${t.number}`);
  return { ok: true };
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
