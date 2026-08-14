"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { openPortalTicket } from "@/services/portal";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  slug: z.string().min(1).max(80),
  body: z.string().min(10, "Conte um pouco mais — precisamos de contexto para ajudar.").max(10_000),
  area: z.string().max(80),
  signup: z
    .object({
      name: z.string().min(1).max(120),
      email: z.email(),
      password: z.string().min(8).max(200),
    })
    .optional(),
});

export async function openTicket(input: {
  slug: string;
  body: string;
  area: string;
  signup?: { name: string; email: string; password: string };
}): Promise<{ ok: boolean; error?: string; createdAccount?: boolean }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "local";

  // Portal e cadastro são a porta aberta para fora — rate limit por IP.
  if (!rateLimit(`portal:${ip}`, { limit: 5, windowMs: 60_000 }).allowed) {
    return {
      ok: false,
      error: "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
    };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Confira os campos e tente de novo.",
    };
  }

  const actor = await getActor();
  const result = await openPortalTicket({ ...parsed.data, actor });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.message ?? "Não deu para abrir o chamado agora. Tente de novo em instantes.",
    };
  }
  return { ok: true, createdAccount: result.value.createdAccount };
}
