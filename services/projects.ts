import { eq, inArray, and, count } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, tickets, ingestionRuns } from "@/db/schema";
import {
  canViewProject,
  canManageProjects,
  type Actor,
} from "@/lib/auth/policies";
import { ok, err, type Result, type NotFound } from "@/lib/result";
import { logAudit } from "@/lib/audit";

export type ProjectSummary = {
  id: string;
  name: string;
  slug: string;
  openCount: number;
  portalEnabled: boolean;
  repoUrl: string | null;
  description: string | null;
};

/** Projetos visíveis ao ator, com contagem de chamados abertos (rail da fila). */
export async function listProjectsForActor(actor: Actor): Promise<ProjectSummary[]> {
  const visible =
    actor.role === "admin"
      ? await db.select().from(projects)
      : actor.projectIds.length === 0
        ? []
        : await db
            .select()
            .from(projects)
            .where(inArray(projects.id, actor.projectIds));

  if (visible.length === 0) return [];

  const counts = await db
    .select({ projectId: tickets.projectId, n: count() })
    .from(tickets)
    .where(
      and(
        inArray(
          tickets.projectId,
          visible.map((p) => p.id),
        ),
        inArray(tickets.status, ["open", "in_analysis", "waiting_author", "in_review"]),
      ),
    )
    .groupBy(tickets.projectId);

  const byProject = new Map(counts.map((c) => [c.projectId, c.n]));
  return visible.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    openCount: byProject.get(p.id) ?? 0,
    portalEnabled: p.portalEnabled,
    repoUrl: p.repoUrl,
    description: p.description,
  }));
}

/** Edição de projeto (admin). Slug não muda — é a URL pública do portal. */
export async function updateProject(
  actor: Actor,
  projectId: string,
  input: {
    name: string;
    description?: string | null;
    repoUrl?: string | null;
    defaultBranch: string;
    portalEnabled: boolean;
    accentColor?: string | null;
  },
): Promise<Result<typeof projects.$inferSelect, "forbidden" | NotFound>> {
  if (!canManageProjects(actor)) return err("forbidden");
  const [updated] = await db
    .update(projects)
    .set({
      name: input.name,
      description: input.description ?? null,
      repoUrl: input.repoUrl ?? null,
      defaultBranch: input.defaultBranch,
      portalEnabled: input.portalEnabled,
      accentColor: input.accentColor ?? null,
    })
    .where(eq(projects.id, projectId))
    .returning();
  if (!updated) return err("not_found");
  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: "project.update",
    entityType: "project",
    entityId: projectId,
  });
  return ok(updated);
}

export async function getProjectBySlug(
  actor: Actor,
  slug: string,
): Promise<Result<typeof projects.$inferSelect, NotFound>> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });
  if (!project || !canViewProject(actor, project.id)) return err("not_found");
  return ok(project);
}

export async function createProject(
  actor: Actor,
  input: {
    name: string;
    slug: string;
    description?: string;
    repoUrl?: string;
    defaultBranch?: string;
    portalEnabled?: boolean;
  },
): Promise<Result<typeof projects.$inferSelect, "forbidden" | "slug_taken">> {
  if (!canManageProjects(actor)) return err("forbidden");
  const existing = await db.query.projects.findFirst({
    where: eq(projects.slug, input.slug),
  });
  if (existing) return err("slug_taken", "Já existe um projeto com este slug.");
  const [created] = await db.insert(projects).values(input).returning();
  if (!created) return err("slug_taken");
  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: "project.create",
    entityType: "project",
    entityId: created.id,
  });
  return ok(created);
}

/** Estado da última indexação — rodapé do rail e tela do projeto. */
export async function getLatestIngestion(projectId: string) {
  return db.query.ingestionRuns.findFirst({
    where: eq(ingestionRuns.projectId, projectId),
    orderBy: (runs, { desc }) => [desc(runs.startedAt)],
  });
}

export type ProjectStats = {
  open: number;
  unassigned: number;
  medianFirstResponseMin: number | null;
  suggestionsAccepted: number;
  suggestionsDecided: number;
  suggestionsOverridden: number;
  dueToday: { number: number }[];
};

/** Os quatro números da tela do projeto — sem seta, sem porcentagem verde. */
export async function getProjectStats(projectId: string): Promise<ProjectStats> {
  const { tickets: t, assignmentSuggestions: s } = await import("@/db/schema");
  const { and, isNull, gte, lt, ne, sql: sqlTag } = await import("drizzle-orm");

  const openStatuses = ["open", "in_analysis", "waiting_author", "in_review"] as const;
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  const [open] = await db
    .select({ n: count() })
    .from(t)
    .where(and(eq(t.projectId, projectId), inArray(t.status, [...openStatuses])));
  const [unassigned] = await db
    .select({ n: count() })
    .from(t)
    .where(
      and(
        eq(t.projectId, projectId),
        inArray(t.status, [...openStatuses]),
        isNull(t.assigneeId),
      ),
    );
  const [median] = await db
    .select({
      m: sqlTag<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${t.firstResponseAt} - ${t.createdAt})))`,
    })
    .from(t)
    .where(and(eq(t.projectId, projectId), sqlTag`${t.firstResponseAt} is not null`));
  const [decided] = await db
    .select({
      total: count(),
      accepted: sqlTag<number>`count(*) filter (where ${s.decision} = 'accepted')`,
      rejected: sqlTag<number>`count(*) filter (where ${s.decision} = 'rejected')`,
    })
    .from(s)
    .innerJoin(t, eq(s.ticketId, t.id))
    .where(and(eq(t.projectId, projectId), ne(s.decision, "pending")));
  const dueToday = await db
    .select({ number: t.number })
    .from(t)
    .where(
      and(
        eq(t.projectId, projectId),
        inArray(t.status, [...openStatuses]),
        gte(t.dueAt, startToday),
        lt(t.dueAt, startTomorrow),
      ),
    );

  return {
    open: open?.n ?? 0,
    unassigned: unassigned?.n ?? 0,
    medianFirstResponseMin:
      median?.m != null ? Math.round(Number(median.m) / 60) : null,
    suggestionsAccepted: Number(decided?.accepted ?? 0),
    suggestionsDecided: decided?.total ?? 0,
    suggestionsOverridden: Number(decided?.rejected ?? 0),
    dueToday,
  };
}

/** Pastas com atividade no git que nenhuma área declarada cobre. */
export async function getUnownedFolders(projectId: string): Promise<string[]> {
  const { codeOwnership, expertiseAreas } = await import("@/db/schema");
  const picomatch = (await import("picomatch")).default;

  const ownership = await db
    .select({ path: codeOwnership.path })
    .from(codeOwnership)
    .where(eq(codeOwnership.projectId, projectId));
  const areas = await db.query.expertiseAreas.findMany({
    where: eq(expertiseAreas.projectId, projectId),
  });
  const matchers = areas
    .filter((a) => a.globs.length > 0)
    .map((a) => picomatch(a.globs));

  const folders = new Map<string, number>();
  for (const row of ownership) {
    const parts = row.path.split("/");
    if (parts.length < 2) continue;
    const folder = parts.slice(0, 2).join("/");
    if (matchers.some((m) => m(row.path))) continue;
    folders.set(folder, (folders.get(folder) ?? 0) + 1);
  }
  return [...folders.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([folder]) => `${folder}/`);
}
