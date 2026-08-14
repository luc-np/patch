import { eq, and, isNull, gt, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { invites, users, projects, projectMembers } from "@/db/schema";
import { canManageProjects, type Actor } from "@/lib/auth/policies";
import { ok, err, type Result, type NotFound } from "@/lib/result";
import { enqueue, QUEUE } from "@/lib/queue";
import { logAudit } from "@/lib/audit";
import { getEnv } from "@/lib/env";

const INVITE_TTL_DAYS = 7;

export type MemberRole = (typeof invites.$inferSelect)["role"];

/** Admin convida por e-mail, com projeto e função. Reenviar = novo convite. */
export async function createInvite(
  actor: Actor,
  input: { email: string; projectId: string; role: MemberRole },
): Promise<Result<{ inviteId: string }, "forbidden" | NotFound | "already_member">> {
  if (!canManageProjects(actor)) return err("forbidden");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
  });
  if (!project) return err("not_found");

  const email = input.email.trim().toLowerCase();

  // Já é membro? Convite seria ruído.
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existingUser) {
    const membership = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, project.id),
        eq(projectMembers.userId, existingUser.id),
      ),
    });
    if (membership) {
      return err("already_member", "Esta pessoa já é membro do projeto.");
    }
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  const [invite] = await db
    .insert(invites)
    .values({
      email,
      projectId: project.id,
      role: input.role,
      invitedBy: actor.id,
      expiresAt,
    })
    .returning();
  if (!invite) return err("not_found");

  const link = `${getEnv().BETTER_AUTH_URL}/convite/${invite.token}`;
  await enqueue(
    QUEUE.email,
    {
      to: email,
      subject: `${actor.name} convidou você para o projeto ${project.name} no Patch`,
      text: `Olá!\n\n${actor.name} convidou você para entrar no time do projeto ${project.name} como ${invite.role}.\n\nAceite o convite por aqui (vale por ${INVITE_TTL_DAYS} dias):\n${link}\n\nSe você não esperava este convite, é só ignorar.`,
    },
    { retryLimit: 5, retryBackoff: true },
  );

  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: "invite.create",
    entityType: "project",
    entityId: project.id,
    metadata: { email, role: input.role },
  });
  return ok({ inviteId: invite.id });
}

export type InviteView = {
  id: string;
  email: string;
  role: MemberRole;
  projectName: string;
  projectSlug: string;
  invitedByName: string;
  /** já existe conta com este e-mail? muda o formulário de aceite */
  hasAccount: boolean;
};

/** Convite válido (não aceito, não expirado) pelo token da URL. */
export async function getInviteByToken(
  token: string,
): Promise<Result<InviteView, NotFound | "expired">> {
  const [row] = await db
    .select({
      invite: invites,
      projectName: projects.name,
      projectSlug: projects.slug,
      invitedByName: users.name,
    })
    .from(invites)
    .innerJoin(projects, eq(invites.projectId, projects.id))
    .innerJoin(users, eq(invites.invitedBy, users.id))
    .where(and(eq(invites.token, token), isNull(invites.acceptedAt)))
    .limit(1);
  if (!row) return err("not_found");
  if (row.invite.expiresAt.getTime() < Date.now()) return err("expired");

  const existing = await db.query.users.findFirst({
    where: eq(users.email, row.invite.email),
  });

  return ok({
    id: row.invite.id,
    email: row.invite.email,
    role: row.invite.role,
    projectName: row.projectName,
    projectSlug: row.projectSlug,
    invitedByName: row.invitedByName,
    hasAccount: Boolean(existing),
  });
}

/**
 * Efetiva o aceite para um usuário já existente (recém-criado no fluxo do
 * convite, ou uma conta antiga): vira staff, entra no projeto, convite fecha.
 * O clique no link do e-mail prova a posse do endereço — a conta é verificada.
 */
export async function acceptInvite(
  token: string,
  userId: string,
): Promise<Result<{ projectSlug: string }, NotFound | "expired" | "email_mismatch">> {
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.token, token), isNull(invites.acceptedAt)))
    .limit(1);
  if (!invite) return err("not_found");
  if (invite.expiresAt.getTime() < Date.now()) return err("expired");

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return err("not_found");
  if (user.email.toLowerCase() !== invite.email) {
    return err(
      "email_mismatch",
      "Este convite foi enviado para outro e-mail.",
    );
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, invite.projectId),
  });
  if (!project) return err("not_found");

  await db
    .update(users)
    .set({
      emailVerified: true,
      // guest convidado vira staff; admin continua admin
      role: user.role === "admin" ? "admin" : "staff",
    })
    .where(eq(users.id, userId));

  await db
    .insert(projectMembers)
    .values({ projectId: invite.projectId, userId, role: invite.role })
    .onConflictDoNothing();

  await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(eq(invites.id, invite.id));

  await logAudit({
    actorUserId: userId,
    actorKind: "user",
    action: "invite.accept",
    entityType: "project",
    entityId: invite.projectId,
    metadata: { role: invite.role },
  });
  return ok({ projectSlug: project.slug });
}

/** Há convite pendente para este e-mail? Usado para pular o e-mail de verificação redundante. */
export async function hasPendingInvite(email: string): Promise<boolean> {
  const row = await db.query.invites.findFirst({
    where: and(
      eq(invites.email, email.toLowerCase()),
      isNull(invites.acceptedAt),
      gt(invites.expiresAt, new Date()),
    ),
  });
  return Boolean(row);
}

/** Convites pendentes visíveis na tela de equipe (admin). */
export async function listPendingInvites(actor: Actor) {
  if (!canManageProjects(actor)) return [];
  return db
    .select({
      id: invites.id,
      email: invites.email,
      role: invites.role,
      projectSlug: projects.slug,
      expiresAt: invites.expiresAt,
    })
    .from(invites)
    .innerJoin(projects, eq(invites.projectId, projects.id))
    .where(and(isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())))
    .orderBy(desc(invites.createdAt));
}
