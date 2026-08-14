import { sendEmail } from "@/lib/email/mailer";
import type { QueuePayloads } from "@/lib/queue";
import type { Logger } from "@/lib/logger";

export async function handleEmail(
  data: QueuePayloads["email"],
  log: Logger,
): Promise<void> {
  await sendEmail({ to: data.to, subject: data.subject, text: data.text });
  log.info("email enviado", { to: data.to, subject: data.subject });
}
