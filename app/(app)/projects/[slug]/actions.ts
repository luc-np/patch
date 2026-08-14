"use server";

import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { canTriggerIngestion } from "@/lib/auth/policies";
import { upsertProjectNote } from "@/services/notes";
import { enqueue, QUEUE } from "@/lib/queue";
import { logAudit } from "@/lib/audit";

const reindexSchema = z.object({ projectId: z.uuid() });

export async function requestReindex(input: {
  projectId: string;
}): Promise<{ ok: boolean }> {
  const actor = await getActor();
  if (!actor) return { ok: false };
  const parsed = reindexSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  if (!canTriggerIngestion(actor, parsed.data.projectId)) return { ok: false };

  await enqueue(
    QUEUE.ingestion,
    { projectId: parsed.data.projectId },
    { singletonKey: parsed.data.projectId, retryLimit: 1 },
  );
  await logAudit({
    actorUserId: actor.id,
    actorKind: "user",
    action: "ingestion.trigger",
    entityType: "project",
    entityId: parsed.data.projectId,
  });
  return { ok: true };
}

const noteSchema = z.object({
  projectId: z.uuid(),
  noteId: z.uuid().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50_000),
});

export async function saveNote(input: {
  projectId: string;
  noteId?: string;
  title: string;
  body: string;
}): Promise<{ ok: boolean }> {
  const actor = await getActor();
  if (!actor) return { ok: false };
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const result = await upsertProjectNote(actor, parsed.data);
  return { ok: result.ok };
}
