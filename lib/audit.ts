import { db } from "@/db/client";
import { auditLog } from "@/db/schema";

export async function logAudit(entry: {
  actorUserId?: string | null;
  actorKind: "user" | "ai" | "system";
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: entry.actorUserId ?? null,
    actorKind: entry.actorKind,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata,
  });
}
