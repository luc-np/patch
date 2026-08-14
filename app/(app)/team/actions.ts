"use server";

import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { createArea, declareExpertise } from "@/services/expertise";

const areaSchema = z.object({
  projectId: z.uuid(),
  name: z.string().min(1).max(80),
  globs: z.array(z.string().max(200)).max(20),
});

export async function createAreaAction(input: {
  projectId: string;
  name: string;
  globs: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada." };
  const parsed = areaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira nome e globs." };

  const result = await createArea(actor, parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "forbidden"
          ? "Só admin cria áreas."
          : (result.message ?? "Não deu para criar."),
    };
  }
  return { ok: true };
}

const declareSchema = z.object({ areaId: z.uuid(), userId: z.string().min(1) });

export async function declareExpertiseAction(input: {
  areaId: string;
  userId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada." };
  const parsed = declareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Seleção inválida." };

  const result = await declareExpertise(actor, parsed.data);
  if (!result.ok) return { ok: false, error: "Só admin declara expertise." };
  return { ok: true };
}
