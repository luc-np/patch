import picomatch from "picomatch";
import { eq, and, inArray, max, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  users,
  projects,
  projectMembers,
  expertiseAreas,
  memberExpertise,
  codeOwnership,
} from "@/db/schema";
import {
  canViewTeam,
  canManageExpertise,
  type Actor,
} from "@/lib/auth/policies";
import { ok, err, type Result, type NotFound } from "@/lib/result";
import { logAudit } from "@/lib/audit";

export type ExpertiseChip = {
  areaId: string;
  areaName: string;
  projectSlug: string;
  /** prova do sinal inferido: nº de commits nos globs da área, ou "sinal fraco" */
  commitCount?: number;
  weak?: boolean;
};

export type TeamMember = {
  userId: string;
  name: string;
  memberRole: string;
  declared: ExpertiseChip[];
  inferred: ExpertiseChip[];
  lastCommitAt: Date | null;
};

/** A tela de equipe: quem sabe o quê, e DE ONDE vem esse dado. */
export async function getTeamExpertise(
  actor: Actor,
): Promise<Result<TeamMember[], NotFound>> {
  if (!canViewTeam(actor)) return err("not_found");

  const visibleProjects =
    actor.role === "admin"
      ? await db.select().from(projects)
      : actor.projectIds.length === 0
        ? []
        : await db.select().from(projects).where(inArray(projects.id, actor.projectIds));
  if (visibleProjects.length === 0) return ok([]);
  const projectIds = visibleProjects.map((p) => p.id);
  const slugById = new Map(visibleProjects.map((p) => [p.id, p.slug]));

  const memberships = await db
    .select({
      userId: projectMembers.userId,
      role: projectMembers.role,
      name: users.name,
      globalRole: users.role,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(inArray(projectMembers.projectId, projectIds));

  const staff = new Map<string, { name: string; role: string }>();
  for (const m of memberships) {
    if (m.globalRole === "guest") continue;
    if (!staff.has(m.userId)) staff.set(m.userId, { name: m.name, role: m.role });
  }
  if (staff.size === 0) return ok([]);
  const staffIds = [...staff.keys()];

  const areas = await db.query.expertiseAreas.findMany({
    where: inArray(expertiseAreas.projectId, projectIds),
  });
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const expertise = areas.length
    ? await db
        .select()
        .from(memberExpertise)
        .where(
          and(
            inArray(memberExpertise.areaId, areas.map((a) => a.id)),
            inArray(memberExpertise.userId, staffIds),
          ),
        )
    : [];

  const ownership = await db
    .select()
    .from(codeOwnership)
    .where(
      and(
        inArray(codeOwnership.projectId, projectIds),
        inArray(codeOwnership.userId, staffIds),
      ),
    );

  const lastCommits = await db
    .select({ userId: codeOwnership.userId, last: max(codeOwnership.lastCommitAt) })
    .from(codeOwnership)
    .where(inArray(codeOwnership.userId, staffIds))
    .groupBy(codeOwnership.userId);
  const lastByUser = new Map(lastCommits.map((r) => [r.userId, r.last]));

  // Commits por (usuário, área) — a prova ao lado do chip inferido
  const commitsByUserArea = new Map<string, number>();
  for (const area of areas) {
    if (area.globs.length === 0) continue;
    const isMatch = picomatch(area.globs);
    for (const row of ownership) {
      if (!row.userId || row.projectId !== area.projectId || !isMatch(row.path)) continue;
      const key = `${row.userId} ${area.id}`;
      commitsByUserArea.set(key, (commitsByUserArea.get(key) ?? 0) + row.commitCount);
    }
  }

  const members: TeamMember[] = [...staff.entries()].map(([userId, info]) => {
    const declared: ExpertiseChip[] = [];
    const inferred: ExpertiseChip[] = [];
    for (const row of expertise) {
      if (row.userId !== userId) continue;
      const area = areaById.get(row.areaId);
      if (!area) continue;
      const chip: ExpertiseChip = {
        areaId: area.id,
        areaName: area.name,
        projectSlug: slugById.get(area.projectId) ?? "",
      };
      if (row.source === "manual") {
        declared.push(chip);
      } else {
        const commits = commitsByUserArea.get(`${userId} ${row.areaId}`) ?? 0;
        inferred.push({ ...chip, commitCount: commits, weak: row.weight < 0.3 });
      }
    }
    return {
      userId,
      name: info.name,
      memberRole: info.role,
      declared,
      inferred,
      lastCommitAt: lastByUser.get(userId) ?? null,
    };
  });

  members.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return ok(members);
}

export async function listAreasForActor(actor: Actor) {
  if (!canViewTeam(actor)) return [];
  const where =
    actor.role === "admin"
      ? undefined
      : actor.projectIds.length === 0
        ? sql`false`
        : inArray(expertiseAreas.projectId, actor.projectIds);
  const rows = await db
    .select({
      id: expertiseAreas.id,
      name: expertiseAreas.name,
      projectSlug: projects.slug,
    })
    .from(expertiseAreas)
    .innerJoin(projects, eq(expertiseAreas.projectId, projects.id))
    .where(where);
  return rows;
}

/** Cria uma área nomeada com globs (admin). */
export async function createArea(
  actor: Actor,
  input: { projectId: string; name: string; description?: string; globs: string[] },
): Promise<Result<void, "forbidden" | "duplicate">> {
  if (!canManageExpertise(actor)) return err("forbidden");
  const [created] = await db
    .insert(expertiseAreas)
    .values(input)
    .onConflictDoNothing()
    .returning();
  if (!created) return err("duplicate", "Já existe uma área com este nome no projeto.");
  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: "expertise_area.create",
    entityType: "project",
    entityId: input.projectId,
    metadata: { name: input.name },
  });
  return ok(undefined);
}

/**
 * Declara expertise manual (o seed humano). A inferida do git vive em linha
 * própria e NUNCA vira declarada sozinha.
 */
export async function declareExpertise(
  actor: Actor,
  input: { areaId: string; userId: string },
): Promise<Result<void, "forbidden">> {
  if (!canManageExpertise(actor)) return err("forbidden");
  await db
    .insert(memberExpertise)
    .values({ areaId: input.areaId, userId: input.userId, source: "manual", weight: 1 })
    .onConflictDoUpdate({
      target: [memberExpertise.areaId, memberExpertise.userId, memberExpertise.source],
      set: { weight: 1, updatedAt: new Date() },
    });
  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: "expertise.declare",
    entityType: "user",
    entityId: input.userId,
    metadata: { areaId: input.areaId },
  });
  return ok(undefined);
}
