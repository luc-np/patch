"use server";

import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { updateProject } from "@/services/projects";

const schema = z.object({
  projectId: z.uuid(),
  name: z.string().min(1).max(80),
  description: z.string().max(2000).optional(),
  repoUrl: z.url().optional(),
  defaultBranch: z.string().min(1).max(100),
  portalEnabled: z.boolean(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor no formato #rrggbb.")
    .optional(),
});

export async function updateProjectAction(input: {
  projectId: string;
  name: string;
  description?: string;
  repoUrl?: string;
  defaultBranch: string;
  portalEnabled: boolean;
  accentColor?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  }

  const { projectId, ...fields } = parsed.data;
  const result = await updateProject(actor, projectId, fields);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error === "forbidden" ? "Só admin edita projetos." : "Projeto não encontrado.",
    };
  }
  return { ok: true };
}
