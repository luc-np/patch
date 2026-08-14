import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectNotes } from "@/db/schema";
import {
  canViewProjectNotes,
  canEditProjectNotes,
  type Actor,
} from "@/lib/auth/policies";
import { ok, err, type Result, type NotFound } from "@/lib/result";

export async function listProjectNotes(
  actor: Actor,
  projectId: string,
): Promise<Result<(typeof projectNotes.$inferSelect)[], NotFound>> {
  if (!canViewProjectNotes(actor, projectId)) return err("not_found");
  const notes = await db.query.projectNotes.findMany({
    where: eq(projectNotes.projectId, projectId),
    orderBy: (n, { desc }) => [desc(n.updatedAt)],
  });
  return ok(notes);
}

export async function upsertProjectNote(
  actor: Actor,
  input: { projectId: string; noteId?: string; title: string; body: string },
): Promise<Result<typeof projectNotes.$inferSelect, NotFound>> {
  if (!canEditProjectNotes(actor, input.projectId)) return err("not_found");

  if (input.noteId) {
    const [updated] = await db
      .update(projectNotes)
      .set({
        title: input.title,
        body: input.body,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(projectNotes.id, input.noteId))
      .returning();
    if (!updated) return err("not_found");
    return ok(updated);
  }

  const [created] = await db
    .insert(projectNotes)
    .values({
      projectId: input.projectId,
      title: input.title,
      body: input.body,
      updatedBy: actor.id,
    })
    .returning();
  if (!created) return err("not_found");
  return ok(created);
}
