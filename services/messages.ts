import { eq, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { tickets, ticketMessages, users } from "@/db/schema";
import {
  canViewTicket,
  canPostMessage,
  canPostInternalNote,
  filterVisibleMessages,
  type Actor,
} from "@/lib/auth/policies";
import { ok, err, type Result, type NotFound } from "@/lib/result";
import { logAudit } from "@/lib/audit";

export type MessageItem = {
  id: string;
  body: string;
  internal: boolean;
  authorId: string | null;
  authorName: string;
  createdAt: Date;
  delivery: (typeof ticketMessages.$inferSelect)["delivery"];
};

export async function listMessages(
  actor: Actor,
  ticketId: string,
): Promise<Result<MessageItem[], NotFound>> {
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket || !canViewTicket(actor, ticket)) return err("not_found");

  const rows = await db
    .select({
      id: ticketMessages.id,
      body: ticketMessages.body,
      internal: ticketMessages.internal,
      authorId: ticketMessages.authorId,
      authorName: users.name,
      createdAt: ticketMessages.createdAt,
      delivery: ticketMessages.delivery,
    })
    .from(ticketMessages)
    .leftJoin(users, eq(ticketMessages.authorId, users.id))
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(asc(ticketMessages.createdAt));

  const visible = filterVisibleMessages(actor, ticket, rows);
  return ok(
    visible.map((m) => ({ ...m, authorName: m.authorName ?? "sistema" })),
  );
}

export type PostMessageResult = {
  message: typeof ticketMessages.$inferSelect;
  /** dados para notificação — o chamador decide enfileirar e-mail/whatsapp */
  ticket: typeof tickets.$inferSelect;
};

export async function postMessage(
  actor: Actor,
  input: { ticketId: string; body: string; internal: boolean },
): Promise<Result<PostMessageResult, NotFound | "forbidden">> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, input.ticketId),
  });
  if (!ticket || !canViewTicket(actor, ticket)) return err("not_found");
  if (input.internal) {
    if (!canPostInternalNote(actor, ticket)) return err("forbidden");
  } else if (!canPostMessage(actor, ticket)) {
    return err("forbidden");
  }

  const [message] = await db
    .insert(ticketMessages)
    .values({
      ticketId: input.ticketId,
      authorId: actor.id,
      body: input.body,
      internal: input.internal,
    })
    .returning();
  if (!message) return err("forbidden");

  // 1ª resposta pública do time conta para o acordo de atendimento.
  const isTeamReply =
    !input.internal && actor.role !== "guest" && actor.id !== ticket.authorId;
  await db
    .update(tickets)
    .set({
      updatedAt: new Date(),
      firstResponseAt:
        isTeamReply && !ticket.firstResponseAt ? new Date() : ticket.firstResponseAt,
    })
    .where(eq(tickets.id, ticket.id));

  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: input.internal ? "ticket.note" : "ticket.reply",
    entityType: "ticket",
    entityId: ticket.id,
  });

  return ok({ message, ticket });
}
