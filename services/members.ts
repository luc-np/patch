import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { projectMembers, users, auditLog } from "@/db/schema";
import { canViewProject, canManageProjects, type Actor } from "@/lib/auth/policies";
import { ok, err, type Result, type NotFound } from "@/lib/result";

export type MemberItem = {
  userId: string;
  name: string;
  email: string;
  role: (typeof projectMembers.$inferSelect)["role"];
};

/** Membros staff de um projeto (para atribuição) — guests ficam de fora da lista. */
export async function listProjectMembers(
  actor: Actor,
  projectId: string,
): Promise<Result<MemberItem[], NotFound>> {
  if (actor.role === "guest") return err("not_found");
  if (!canViewProject(actor, projectId)) return err("not_found");

  const rows = await db
    .select({
      userId: projectMembers.userId,
      name: users.name,
      email: users.email,
      role: projectMembers.role,
      globalRole: users.role,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));

  return ok(
    rows
      .filter((r) => r.globalRole !== "guest")
      .map(({ globalRole: _globalRole, ...m }) => m),
  );
}

export async function addProjectMember(
  actor: Actor,
  input: {
    projectId: string;
    userId: string;
    role: (typeof projectMembers.$inferSelect)["role"];
  },
): Promise<Result<void, "forbidden">> {
  if (!canManageProjects(actor)) return err("forbidden");
  await db.insert(projectMembers).values(input).onConflictDoNothing();
  return ok(undefined);
}

export type ActivityItem = {
  id: string;
  action: string;
  actorKind: "user" | "ai" | "system";
  actorName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

/** Trilha de atividade de um ticket (rail direito), ordem decrescente. */
export async function listTicketActivity(
  ticketId: string,
): Promise<ActivityItem[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      actorKind: auditLog.actorKind,
      actorName: users.name,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorUserId, users.id))
    .where(and(eq(auditLog.entityType, "ticket"), eq(auditLog.entityId, ticketId)))
    .orderBy(auditLog.createdAt);

  return rows.reverse();
}

/** Usuários staff/admin fora de um projeto — para o admin montar o time. */
export async function listStaffUsers(actor: Actor) {
  if (actor.role === "guest") return [];
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(inArray(users.role, ["admin", "staff"]));
}
