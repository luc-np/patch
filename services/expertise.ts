import { eq, and, inArray, max, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { users, projects, projectMembers, codeOwnership } from "@/db/schema";
import {
  canViewTeam,
  canManageProjects,
  type Actor,
} from "@/lib/auth/policies";
import { ok, err, type Result, type NotFound } from "@/lib/result";
import { getAiProvider } from "@/lib/ai/provider";
import { logAudit } from "@/lib/audit";

export type MemberProjectLink = {
  projectId: string;
  slug: string;
  role: (typeof projectMembers.$inferSelect)["role"];
};

export type TeamMember = {
  userId: string;
  name: string;
  email: string;
  /** perfil de especialidades em texto livre — o que a IA lê */
  expertise: string | null;
  projects: MemberProjectLink[];
  lastCommitAt: Date | null;
};

/** A equipe: quem é, o que faz (perfil) e em quais projetos está. */
export async function getTeam(actor: Actor): Promise<Result<TeamMember[], NotFound>> {
  if (!canViewTeam(actor)) return err("not_found");

  const visibleProjects =
    actor.role === "admin"
      ? await db.select().from(projects)
      : actor.projectIds.length === 0
        ? []
        : await db.select().from(projects).where(inArray(projects.id, actor.projectIds));
  const slugById = new Map(visibleProjects.map((p) => [p.id, p.slug]));

  const staffUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      expertise: users.expertise,
    })
    .from(users)
    .where(inArray(users.role, ["admin", "staff"]));
  if (staffUsers.length === 0) return ok([]);
  const staffIds = staffUsers.map((u) => u.id);

  const memberships = await db
    .select()
    .from(projectMembers)
    .where(inArray(projectMembers.userId, staffIds));

  const lastCommits = await db
    .select({ userId: codeOwnership.userId, last: max(codeOwnership.lastCommitAt) })
    .from(codeOwnership)
    .where(inArray(codeOwnership.userId, staffIds))
    .groupBy(codeOwnership.userId);
  const lastByUser = new Map(lastCommits.map((r) => [r.userId, r.last]));

  const members: TeamMember[] = staffUsers.map((u) => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    expertise: u.expertise,
    projects: memberships
      .filter((m) => m.userId === u.id && slugById.has(m.projectId))
      .map((m) => ({
        projectId: m.projectId,
        slug: slugById.get(m.projectId) ?? "",
        role: m.role,
      })),
    lastCommitAt: lastByUser.get(u.id) ?? null,
  }));

  members.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return ok(members);
}

/**
 * Atualiza o perfil do funcionário: o texto de especialidades vira embedding
 * (é ele que a triagem compara com cada chamado) e os vínculos de projeto são
 * sincronizados — um dev pode estar em quantos projetos precisar.
 */
export async function updateMemberProfile(
  actor: Actor,
  input: {
    userId: string;
    expertise: string;
    memberships: { projectId: string; role: (typeof projectMembers.$inferSelect)["role"] }[];
  },
): Promise<Result<void, "forbidden" | NotFound>> {
  if (!canManageProjects(actor)) return err("forbidden");

  const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  if (!user || user.role === "guest") return err("not_found");

  const text = input.expertise.trim();
  let embedding: number[] | null = null;
  if (text.length > 0) {
    const [vector] = await getAiProvider().embed([text], { inputType: "document" });
    embedding = vector ?? null;
  }

  await db
    .update(users)
    .set({ expertise: text || null, expertiseEmbedding: embedding })
    .where(eq(users.id, input.userId));

  // Sincroniza vínculos: adiciona os marcados, remove os desmarcados.
  const wantedIds = input.memberships.map((m) => m.projectId);
  if (wantedIds.length > 0) {
    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.userId, input.userId),
          notInArray(projectMembers.projectId, wantedIds),
        ),
      );
  } else {
    await db.delete(projectMembers).where(eq(projectMembers.userId, input.userId));
  }
  for (const m of input.memberships) {
    await db
      .insert(projectMembers)
      .values({ projectId: m.projectId, userId: input.userId, role: m.role })
      .onConflictDoUpdate({
        target: [projectMembers.projectId, projectMembers.userId],
        set: { role: m.role },
      });
  }

  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: "profile.update",
    entityType: "user",
    entityId: input.userId,
    metadata: { projects: wantedIds.length, hasExpertise: text.length > 0 },
  });
  return ok(undefined);
}
