"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { getActor } from "@/lib/auth/session";
import { getInviteByToken, acceptInvite } from "@/services/invites";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";

const newAccountSchema = z.object({
  token: z.uuid(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
});

export async function acceptWithNewAccount(input: {
  token: string;
  name: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`invite:${ip}`, { limit: 5, windowMs: 60_000 }).allowed) {
    return { ok: false, error: "Muitas tentativas. Espere um minuto." };
  }

  const parsed = newAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira nome e senha." };

  const inviteResult = await getInviteByToken(parsed.data.token);
  if (!inviteResult.ok) {
    return {
      ok: false,
      error:
        inviteResult.error === "expired"
          ? "Este convite expirou — peça um novo."
          : "Convite não encontrado.",
    };
  }
  const invite = inviteResult.value;
  if (invite.hasAccount) {
    return { ok: false, error: "Já existe conta com este e-mail — entre para aceitar." };
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: invite.email,
        password: parsed.data.password,
      },
    });
  } catch {
    return { ok: false, error: "Não deu para criar sua conta agora." };
  }

  const created = await db.query.users.findFirst({
    where: eq(users.email, invite.email),
  });
  if (!created) return { ok: false, error: "Não deu para criar sua conta agora." };

  const accepted = await acceptInvite(parsed.data.token, created.id);
  if (!accepted.ok) return { ok: false, error: accepted.message ?? "Convite inválido." };
  return { ok: true };
}

const acceptSchema = z.object({ token: z.uuid() });

export async function acceptAsLoggedUser(input: {
  token: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada — entre de novo." };
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Convite inválido." };

  const result = await acceptInvite(parsed.data.token, actor.id);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "email_mismatch"
          ? "Este convite foi enviado para outro e-mail."
          : result.error === "expired"
            ? "Este convite expirou — peça um novo."
            : "Convite não encontrado.",
    };
  }
  return { ok: true };
}
