"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { decideSuggestion, undoDecision } from "@/services/suggestions";

const decideSchema = z.object({
  suggestionId: z.uuid(),
  decision: z.enum(["accepted", "rejected"]),
  chosenUserId: z.string().optional(),
});

export async function decideSuggestionAction(input: {
  suggestionId: string;
  decision: "accepted" | "rejected";
  chosenUserId?: string;
}): Promise<{ ok: boolean }> {
  const actor = await getActor();
  if (!actor) return { ok: false };
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const result = await decideSuggestion(actor, parsed.data);
  revalidatePath("/");
  return { ok: result.ok };
}

const undoSchema = z.object({ suggestionId: z.uuid() });

export async function undoSuggestionAction(input: {
  suggestionId: string;
}): Promise<{ ok: boolean }> {
  const actor = await getActor();
  if (!actor) return { ok: false };
  const parsed = undoSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const result = await undoDecision(actor, parsed.data.suggestionId);
  revalidatePath("/");
  return { ok: result.ok };
}
