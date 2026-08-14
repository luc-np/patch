import { runIngestion } from "@/services/ingestion/run";
import type { QueuePayloads } from "@/lib/queue";
import type { Logger } from "@/lib/logger";

export async function handleIngestion(
  data: QueuePayloads["ingestion"],
  log: Logger,
): Promise<void> {
  await runIngestion(data.projectId, log.child({ projectId: data.projectId }));
}
