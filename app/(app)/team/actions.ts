"use server";

import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { updateMemberProfile } from "@/services/expertise";
import { createInvite } from "@/services/invites";

const inviteSchema = z.object({
  email: z.email(),
  projectId: z.uuid(),
  role: z.enum(["dev", "cs", "qa", "designer", "po"]),
});

export async function inviteAction(input: {
  email: string;
  projectId: string;
  role: "dev" | "cs" | "qa" | "designer" | "po";
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada." };
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira o e-mail e a função." };

  const result = await createInvite(actor, parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "already_member"
          ? "Esta pessoa já é membro do projeto."
          : result.error === "forbidden"
            ? "Só admin convida."
            : "Não deu para convidar agora.",
    };
  }
  return { ok: true };
}

const profileSchema = z.object({
  userId: z.string().min(1),
  expertise: z.string().max(4000),
  memberships: z
    .array(
      z.object({
        projectId: z.uuid(),
        role: z.enum(["dev", "cs", "qa", "designer", "po", "collaborator"]),
      }),
    )
    .max(50),
});

export async function updateProfileAction(input: {
  userId: string;
  expertise: string;
  memberships: { projectId: string; role: "dev" | "cs" | "qa" | "designer" | "po" | "collaborator" }[];
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os campos do perfil." };

  const result = await updateMemberProfile(actor, parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "forbidden"
          ? "Só admin edita perfis."
          : "Pessoa não encontrada.",
    };
  }
  return { ok: true };
}
