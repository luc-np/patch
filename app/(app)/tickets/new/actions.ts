"use server";

import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { createTicket } from "@/services/tickets";

const schema = z.object({
  projectId: z.uuid(),
  type: z.enum(["task", "bug"]),
  title: z.string().min(1).max(200),
  body: z.string().max(20_000),
  priority: z.enum(["low", "normal", "high", "urgent"]),
});

export async function createInternalTicket(input: {
  projectId: string;
  type: "task" | "bug";
  title: string;
  body: string;
  priority: "low" | "normal" | "high" | "urgent";
}): Promise<{ ok: boolean; number?: number; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada — entre de novo." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Preencha título e projeto." };

  const result = await createTicket(actor, {
    ...parsed.data,
    origin: "internal",
  });
  if (!result.ok) return { ok: false, error: "Não deu para abrir agora." };
  return { ok: true, number: result.value.number };
}
