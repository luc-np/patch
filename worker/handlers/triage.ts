import { runTriage } from "@/services/triage";
import type { QueuePayloads } from "@/lib/queue";
import type { Logger } from "@/lib/logger";

export async function handleTriage(
  data: QueuePayloads["triage"],
  log: Logger,
): Promise<void> {
  await runTriage(data.ticketId, log.child({ ticketId: data.ticketId }));
}
