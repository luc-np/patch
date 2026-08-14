import { processInbound, deliverWhatsappMessage } from "@/services/whatsapp";
import type { QueuePayloads } from "@/lib/queue";
import type { Logger } from "@/lib/logger";

export async function handleWhatsappInbound(
  data: QueuePayloads["whatsapp-inbound"],
  log: Logger,
): Promise<void> {
  await processInbound(data, log);
}

export async function handleWhatsappSend(
  data: QueuePayloads["whatsapp-send"],
  log: Logger,
): Promise<void> {
  await deliverWhatsappMessage(data.ticketMessageId, log);
}
