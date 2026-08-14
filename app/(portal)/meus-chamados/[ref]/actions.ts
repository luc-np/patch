"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { postMessage } from "@/services/messages";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  ticketId: z.uuid(),
  ticketNumber: z.number(),
  body: z.string().min(1).max(10_000),
});

export async function guestReply(input: {
  ticketId: string;
  ticketNumber: number;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada — entre de novo." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`reply:${actor.id}:${ip}`, { limit: 10, windowMs: 60_000 }).allowed) {
    return { ok: false, error: "Muitas mensagens seguidas. Espere um instante." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Mensagem inválida." };

  const result = await postMessage(actor, {
    ticketId: parsed.data.ticketId,
    body: parsed.data.body,
    internal: false,
  });
  if (!result.ok) return { ok: false, error: "Não deu para enviar agora." };

  revalidatePath(`/meus-chamados/${parsed.data.ticketNumber}`);
  return { ok: true };
}
