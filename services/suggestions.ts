import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { tickets, users, assignmentSuggestions } from "@/db/schema";
import {
  canViewSuggestions,
  canDecideSuggestion,
  type Actor,
} from "@/lib/auth/policies";
import { ok, err, type Result, type NotFound } from "@/lib/result";
import { logAudit } from "@/lib/audit";

export type SuggestionView = typeof assignmentSuggestions.$inferSelect & {
  suggestedUserName: string | null;
};

/** Última sugestão do ticket (pendente ou decidida) — para o bloco de IA. */
export async function getLatestSuggestion(
  actor: Actor,
  ticketId: string,
): Promise<Result<SuggestionView | null, NotFound>> {
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket || !canViewSuggestions(actor, ticket)) return err("not_found");

  const [row] = await db
    .select({
      suggestion: assignmentSuggestions,
      suggestedUserName: users.name,
    })
    .from(assignmentSuggestions)
    .leftJoin(users, eq(assignmentSuggestions.suggestedUserId, users.id))
    .where(eq(assignmentSuggestions.ticketId, ticketId))
    .orderBy(desc(assignmentSuggestions.createdAt))
    .limit(1);

  if (!row) return ok(null);
  return ok({ ...row.suggestion, suggestedUserName: row.suggestedUserName });
}

/**
 * Decisão humana sobre a sugestão. Aceitar atribui; recusar/escolher outra
 * pessoa registra a recusa (e opcionalmente atribui quem foi escolhido).
 * Toda decisão fica gravada — é o único jeito de medir se a IA acerta.
 */
export async function decideSuggestion(
  actor: Actor,
  input: {
    suggestionId: string;
    decision: "accepted" | "rejected";
    /** ao recusar, a pessoa escolhida manualmente (opcional) */
    chosenUserId?: string;
  },
): Promise<Result<void, NotFound | "already_decided">> {
  const suggestion = await db.query.assignmentSuggestions.findFirst({
    where: eq(assignmentSuggestions.id, input.suggestionId),
  });
  if (!suggestion) return err("not_found");

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, suggestion.ticketId),
  });
  if (!ticket || !canDecideSuggestion(actor, ticket)) return err("not_found");
  if (suggestion.decision !== "pending") return err("already_decided");

  await db
    .update(assignmentSuggestions)
    .set({
      decision: input.decision,
      decidedBy: actor.id,
      decidedAt: new Date(),
    })
    .where(eq(assignmentSuggestions.id, input.suggestionId));

  const assigneeId =
    input.decision === "accepted"
      ? suggestion.suggestedUserId
      : (input.chosenUserId ?? null);
  if (assigneeId) {
    await db
      .update(tickets)
      .set({ assigneeId, updatedAt: new Date() })
      .where(eq(tickets.id, ticket.id));
  }

  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action:
      input.decision === "accepted" ? "suggestion.accepted" : "suggestion.rejected",
    entityType: "ticket",
    entityId: ticket.id,
    metadata: {
      suggestionId: input.suggestionId,
      suggestedUserId: suggestion.suggestedUserId,
      chosenUserId: input.chosenUserId ?? null,
    },
  });
  return ok(undefined);
}

/** Desfazer um aceite: remove a atribuição e reabre a sugestão como pendente. */
export async function undoDecision(
  actor: Actor,
  suggestionId: string,
): Promise<Result<void, NotFound>> {
  const suggestion = await db.query.assignmentSuggestions.findFirst({
    where: eq(assignmentSuggestions.id, suggestionId),
  });
  if (!suggestion) return err("not_found");
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, suggestion.ticketId),
  });
  if (!ticket || !canDecideSuggestion(actor, ticket)) return err("not_found");

  await db
    .update(assignmentSuggestions)
    .set({ decision: "pending", decidedBy: null, decidedAt: null })
    .where(eq(assignmentSuggestions.id, suggestionId));
  if (suggestion.decision === "accepted") {
    await db
      .update(tickets)
      .set({ assigneeId: null, updatedAt: new Date() })
      .where(eq(tickets.id, ticket.id));
  }
  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: "suggestion.undo",
    entityType: "ticket",
    entityId: ticket.id,
    metadata: { suggestionId },
  });
  return ok(undefined);
}
