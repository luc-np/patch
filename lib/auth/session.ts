import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/db/client";
import { projectMembers } from "@/db/schema";
import type { Actor } from "@/lib/auth/policies";

/** Carrega o ator autenticado (papel global + projetos em que é membro) em 1 query. */
export async function getActor(): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const memberships = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, session.user.id));

  const role = session.user.role;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: role === "admin" || role === "staff" ? role : "guest",
    projectIds: memberships.map((m) => m.projectId),
  };
}
