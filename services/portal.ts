import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, projectMembers, users } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { createTicket } from "@/services/tickets";
import { enqueue, QUEUE } from "@/lib/queue";
import { randomUUID } from "node:crypto";
import type { Actor } from "@/lib/auth/policies";
import { ok, err, type Result, type NotFound } from "@/lib/result";

/** Projeto visível no portal — só existe publicamente se o portal estiver ligado. */
export async function getPortalProject(
  slug: string,
): Promise<Result<typeof projects.$inferSelect, NotFound>> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });
  if (!project || !project.portalEnabled) return err("not_found");
  return ok(project);
}

/** Garante vínculo de colaborador externo com o projeto (idempotente). */
export async function ensureGuestMembership(
  userId: string,
  projectId: string,
): Promise<void> {
  await db
    .insert(projectMembers)
    .values({ projectId, userId, role: "collaborator" })
    .onConflictDoNothing();
}

export type OpenPortalTicketInput = {
  slug: string;
  body: string;
  area: string;
  /** presentes apenas quando quem abre ainda não tem conta */
  signup?: { name: string; email: string; password: string };
  actor: Actor | null;
};

export type OpenPortalTicketOutput = {
  ticketNumber: number;
  createdAccount: boolean;
};

export async function openPortalTicket(
  input: OpenPortalTicketInput,
): Promise<
  Result<OpenPortalTicketOutput, NotFound | "email_in_use" | "signup_failed" | "forbidden">
> {
  const projectResult = await getPortalProject(input.slug);
  if (!projectResult.ok) return projectResult;
  const project = projectResult.value;

  let actor = input.actor;
  let createdAccount = false;

  if (!actor) {
    if (!input.signup) return err("forbidden");
    const existing = await db.query.users.findFirst({
      where: eq(users.email, input.signup.email),
    });
    if (existing)
      return err(
        "email_in_use",
        "Este e-mail já tem conta — entre para abrir o chamado.",
      );
    try {
      await auth.api.signUpEmail({
        body: {
          name: input.signup.name,
          email: input.signup.email,
          password: input.signup.password,
        },
      });
    } catch {
      return err("signup_failed", "Não deu para criar sua conta agora.");
    }
    const created = await db.query.users.findFirst({
      where: eq(users.email, input.signup.email),
    });
    if (!created) return err("signup_failed");
    createdAccount = true;
    actor = {
      id: created.id,
      name: created.name,
      email: created.email,
      role: "guest",
      projectIds: [],
    };
  }

  await ensureGuestMembership(actor.id, project.id);
  const actorWithProject: Actor = {
    ...actor,
    projectIds: actor.projectIds.includes(project.id)
      ? actor.projectIds
      : [...actor.projectIds, project.id],
  };

  const title =
    input.body.length > 80 ? `${input.body.slice(0, 77)}…` : input.body;
  const result = await createTicket(actorWithProject, {
    projectId: project.id,
    type: "support",
    title: `${input.area ? `[${input.area}] ` : ""}${title}`,
    body: input.body,
    origin: "portal",
  });
  if (!result.ok) return err("forbidden");

  // Chamado externo entra direto na triagem por IA
  await enqueue(
    QUEUE.triage,
    { ticketId: result.value.id, correlationId: randomUUID().slice(0, 8) },
    { retryLimit: 3, retryBackoff: true },
  );

  return ok({ ticketNumber: result.value.number, createdAccount });
}
