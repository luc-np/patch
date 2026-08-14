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
  }));
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
