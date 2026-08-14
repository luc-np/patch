"use server";

import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { createProject } from "@/services/projects";
import { db } from "@/db/client";
import { projectMembers } from "@/db/schema";

const schema = z.object({
  name: z.string().min(1).max(80),
  slug: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug só com letras minúsculas, números e hífen."),
  description: z.string().max(2000).optional(),
  repoUrl: z.url().optional().or(z.literal("").transform(() => undefined)),
  defaultBranch: z.string().min(1).max(100),
  portalEnabled: z.boolean(),
});

export async function createProjectAction(input: {
  name: string;
  slug: string;
  description?: string;
  repoUrl?: string;
  defaultBranch: string;
  portalEnabled: boolean;
}): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  }

  const result = await createProject(actor, parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "slug_taken"
          ? "Já existe um projeto com este slug."
          : "Só admin cria projetos.",
    };
  }

  // Quem cria já entra como membro — sem isso o projeto nasce invisível na fila do próprio admin.
  await db
    .insert(projectMembers)
    .values({ projectId: result.value.id, userId: actor.id, role: "po" })
    .onConflictDoNothing();

  return { ok: true, slug: result.value.slug };
}
