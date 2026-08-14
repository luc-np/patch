import {
  eq,
  and,
  or,
  inArray,
  isNull,
  desc,
  sql,
  gte,
  lt,
  count,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  tickets,
  projects,
  users,
  assignmentSuggestions,
  type SuggestionEvidence,
} from "@/db/schema";
import {
  canViewTicket,
  canCreateTicket,
  canUpdateTicket,
  canAssignTicket,
  type Actor,
} from "@/lib/auth/policies";
import { ok, err, type Result, type NotFound } from "@/lib/result";
import { logAudit } from "@/lib/audit";

const OPEN_STATUSES = [
  "open",
  "in_analysis",
  "waiting_author",
  "in_review",
] as const;

export type QueueView = "mine" | "unassigned" | "suggested" | "due_today" | "all";

export type QueueFilters = {
  view: QueueView;
  projectSlug?: string;
  status?: (typeof tickets.$inferSelect)["status"];
  assigneeId?: string;
  origins?: ("portal" | "whatsapp" | "internal")[];
  search?: string;
};

export type QueueItem = {
  id: string;
  number: number;
  title: string;
  projectSlug: string;
  origin: "portal" | "whatsapp" | "internal";
  status: (typeof tickets.$inferSelect)["status"];
  assigneeName: string | null;
  suggestedName: string | null;
  hasPendingSuggestion: boolean;
  dueToday: boolean;
  updatedAt: Date;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfTomorrow(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

/** Ids de projeto que o ator enxerga; nulo = todos (admin). */
async function visibleProjectIds(actor: Actor): Promise<string[] | null> {
  if (actor.role === "admin") return null;
  return actor.projectIds;
}

/** A fila é do app interno: guest não entra aqui (o portal tem visão própria). */
export async function listQueue(
  actor: Actor,
  filters: QueueFilters,
): Promise<Result<QueueItem[], "forbidden">> {
  if (actor.role === "guest") return err("forbidden");

  const projectIds = await visibleProjectIds(actor);
  if (projectIds !== null && projectIds.length === 0) return ok([]);

  const assignee = alias(users, "assignee");
  const suggestedUser = alias(users, "suggested_user");

  // Última sugestão pendente por ticket (lateral join simplificado por subquery)
  const latestSuggestion = db
    .select({
      ticketId: assignmentSuggestions.ticketId,
      suggestedUserId: assignmentSuggestions.suggestedUserId,
      rowNumber:
        sql<number>`row_number() over (partition by ${assignmentSuggestions.ticketId} order by ${assignmentSuggestions.createdAt} desc)`.as(
          "rn",
        ),
    })
    .from(assignmentSuggestions)
    .where(eq(assignmentSuggestions.decision, "pending"))
    .as("latest_suggestion");

  const conditions = [
    projectIds !== null ? inArray(tickets.projectId, projectIds) : undefined,
    filters.view === "mine" ? eq(tickets.assigneeId, actor.id) : undefined,
    filters.view === "mine" || filters.view === "all"
      ? inArray(tickets.status, [...OPEN_STATUSES])
      : undefined,
    filters.view === "unassigned"
      ? and(isNull(tickets.assigneeId), inArray(tickets.status, [...OPEN_STATUSES]))
      : undefined,
    filters.view === "due_today"
      ? and(
          gte(tickets.dueAt, startOfToday()),
          lt(tickets.dueAt, startOfTomorrow()),
          inArray(tickets.status, [...OPEN_STATUSES]),
        )
      : undefined,
    filters.view === "suggested"
      ? inArray(tickets.status, [...OPEN_STATUSES])
      : undefined,
    filters.status ? eq(tickets.status, filters.status) : undefined,
    filters.assigneeId ? eq(tickets.assigneeId, filters.assigneeId) : undefined,
    filters.origins && filters.origins.length > 0
      ? inArray(tickets.origin, filters.origins)
      : undefined,
    filters.search
      ? sql`(${tickets.title} ilike ${"%" + filters.search + "%"} or ${tickets.body} ilike ${"%" + filters.search + "%"})`
      : undefined,
  ].filter((c) => c !== undefined);

  let query = db
    .select({
      id: tickets.id,
      number: tickets.number,
      title: tickets.title,
      projectSlug: projects.slug,
      projectId: tickets.projectId,
      origin: tickets.origin,
      status: tickets.status,
      dueAt: tickets.dueAt,
      updatedAt: tickets.updatedAt,
      assigneeName: assignee.name,
      suggestedName: suggestedUser.name,
      suggestionTicket: latestSuggestion.ticketId,
    })
    .from(tickets)
    .innerJoin(projects, eq(tickets.projectId, projects.id))
    .leftJoin(assignee, eq(tickets.assigneeId, assignee.id))
    .leftJoin(
      latestSuggestion,
      and(
        eq(latestSuggestion.ticketId, tickets.id),
        eq(latestSuggestion.rowNumber, 1),
      ),
    )
    .leftJoin(suggestedUser, eq(latestSuggestion.suggestedUserId, suggestedUser.id))
    .where(and(...conditions))
    .orderBy(desc(tickets.updatedAt))
    .limit(200)
    .$dynamic();

  if (filters.projectSlug) {
    query = query.where(eq(projects.slug, filters.projectSlug));
  }

  let rows = await query;
  if (filters.view === "suggested") {
    rows = rows.filter((r) => r.suggestionTicket !== null && !r.assigneeName);
  }

  const today = startOfToday();
  const tomorrow = startOfTomorrow();
  return ok(
    rows.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      projectSlug: r.projectSlug,
      origin: r.origin,
      status: r.status,
      assigneeName: r.assigneeName,
      suggestedName: r.assigneeName ? null : r.suggestedName,
      hasPendingSuggestion: r.suggestionTicket !== null,
      dueToday: r.dueAt !== null && r.dueAt >= today && r.dueAt < tomorrow,
      updatedAt: r.updatedAt,
    })),
  );
}

export type QueueCounts = {
  mine: number;
  unassigned: number;
  suggested: number;
  dueToday: number;
};

export async function getQueueCounts(
  actor: Actor,
): Promise<Result<QueueCounts, "forbidden">> {
  if (actor.role === "guest") return err("forbidden");
  const projectIds = await visibleProjectIds(actor);
  if (projectIds !== null && projectIds.length === 0)
    return ok({ mine: 0, unassigned: 0, suggested: 0, dueToday: 0 });

  const scope = [
    projectIds !== null ? inArray(tickets.projectId, projectIds) : undefined,
    inArray(tickets.status, [...OPEN_STATUSES]),
  ].filter((c) => c !== undefined);

  const [mine] = await db
    .select({ n: count() })
    .from(tickets)
    .where(and(...scope, eq(tickets.assigneeId, actor.id)));
  const [unassigned] = await db
    .select({ n: count() })
    .from(tickets)
    .where(and(...scope, isNull(tickets.assigneeId)));
  const [suggested] = await db
    .select({ n: sql<number>`count(distinct ${tickets.id})` })
    .from(tickets)
    .innerJoin(
      assignmentSuggestions,
      and(
        eq(assignmentSuggestions.ticketId, tickets.id),
        eq(assignmentSuggestions.decision, "pending"),
      ),
    )
    .where(and(...scope, isNull(tickets.assigneeId)));
  const [dueToday] = await db
    .select({ n: count() })
    .from(tickets)
    .where(
      and(
        ...scope,
        gte(tickets.dueAt, startOfToday()),
        lt(tickets.dueAt, startOfTomorrow()),
      ),
    );

  return ok({
    mine: mine?.n ?? 0,
    unassigned: unassigned?.n ?? 0,
    suggested: Number(suggested?.n ?? 0),
    dueToday: dueToday?.n ?? 0,
  });
}

export type TicketDetail = typeof tickets.$inferSelect & {
  projectSlug: string;
  projectName: string;
  authorName: string;
  authorEmail: string;
  authorTicketCount: number;
  assigneeName: string | null;
};

/** Carrega e aplica a policy — invisível devolve o MESMO not_found que inexistente. */
export async function getTicketByNumber(
  actor: Actor,
  number: number,
): Promise<Result<TicketDetail, NotFound>> {
  const assignee = alias(users, "assignee");
  const [row] = await db
    .select({
      ticket: tickets,
      projectSlug: projects.slug,
      projectName: projects.name,
      authorName: users.name,
      authorEmail: users.email,
      assigneeName: assignee.name,
    })
    .from(tickets)
    .innerJoin(projects, eq(tickets.projectId, projects.id))
    .innerJoin(users, eq(tickets.authorId, users.id))
    .leftJoin(assignee, eq(tickets.assigneeId, assignee.id))
    .where(eq(tickets.number, number))
    .limit(1);

  if (!row || !canViewTicket(actor, row.ticket)) return err("not_found");

  const [authorCount] = await db
    .select({ n: count() })
    .from(tickets)
    .where(eq(tickets.authorId, row.ticket.authorId));

  return ok({
    ...row.ticket,
    projectSlug: row.projectSlug,
    projectName: row.projectName,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    authorTicketCount: authorCount?.n ?? 0,
    assigneeName: row.assigneeName,
  });
}

export async function createTicket(
  actor: Actor,
  input: {
    projectId: string;
    type: "task" | "support" | "bug";
    title: string;
    body: string;
    priority?: (typeof tickets.$inferSelect)["priority"];
    origin: "portal" | "whatsapp" | "internal";
    externalRef?: string;
    dueAt?: Date;
    authorId?: string; // apenas fluxos de sistema (whatsapp) podem criar por outro autor
  },
): Promise<Result<typeof tickets.$inferSelect, NotFound | "forbidden">> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
  });
  if (!project) return err("not_found");
  if (
    !canCreateTicket(actor, {
      projectId: project.id,
      type: input.type,
      portalEnabled: project.portalEnabled,
    })
  ) {
    // Projeto que o ator não enxerga é indistinguível de inexistente.
    return actor.role === "guest" || !actor.projectIds.includes(project.id)
      ? err("not_found")
      : err("forbidden");
  }

  const [created] = await db
    .insert(tickets)
    .values({
      projectId: input.projectId,
      type: input.type,
      title: input.title,
      body: input.body,
      priority: input.priority ?? "normal",
      origin: input.origin,
      externalRef: input.externalRef,
      dueAt: input.dueAt,
      authorId: input.authorId ?? actor.id,
    })
    .returning();
  if (!created) return err("forbidden");

  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: "ticket.create",
    entityType: "ticket",
    entityId: created.id,
    metadata: { origin: input.origin, type: input.type },
  });
  return ok(created);
}

export async function updateTicketStatus(
  actor: Actor,
  ticketId: string,
  status: (typeof tickets.$inferSelect)["status"],
  resolution?: string,
): Promise<Result<void, NotFound>> {
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket || !canViewTicket(actor, ticket)) return err("not_found");
  if (!canUpdateTicket(actor, ticket)) return err("not_found");

  await db
    .update(tickets)
    .set({
      status,
      resolution: resolution ?? ticket.resolution,
      resolvedAt:
        status === "resolved" && ticket.status !== "resolved"
          ? new Date()
          : ticket.resolvedAt,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, ticketId));

  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: "ticket.status",
    entityType: "ticket",
    entityId: ticketId,
    metadata: { from: ticket.status, to: status },
  });
  return ok(undefined);
}

export async function assignTicket(
  actor: Actor,
  ticketId: string,
  assigneeId: string | null,
): Promise<Result<void, NotFound>> {
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket || !canAssignTicket(actor, ticket)) return err("not_found");

  await db
    .update(tickets)
    .set({ assigneeId, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));

  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: assigneeId ? "ticket.assign" : "ticket.unassign",
    entityType: "ticket",
    entityId: ticketId,
    metadata: { assigneeId },
  });
  return ok(undefined);
}

/** Tickets abertos por um guest — visão "meus chamados" do portal. */
export async function listOwnTickets(actor: Actor) {
  return db
    .select({
      id: tickets.id,
      number: tickets.number,
      title: tickets.title,
      status: tickets.status,
      createdAt: tickets.createdAt,
      projectSlug: projects.slug,
      projectName: projects.name,
    })
    .from(tickets)
    .innerJoin(projects, eq(tickets.projectId, projects.id))
    .where(
      and(
        eq(tickets.authorId, actor.id),
        or(eq(tickets.type, "support"), eq(tickets.type, "bug")),
      ),
    )
    .orderBy(desc(tickets.createdAt));
}

export type { SuggestionEvidence };
