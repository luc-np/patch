import "dotenv/config";
import { getBoss, QUEUE, type QueuePayloads, type QueueName } from "@/lib/queue";
import { createLogger } from "@/lib/logger";
import { handleEmail } from "./handlers/email";
import {
  handleWhatsappInbound,
  handleWhatsappSend,
} from "./handlers/whatsapp";
import { handleIngestion } from "./handlers/ingestion";
import { handleTriage } from "./handlers/triage";

/**
 * Background Worker: processa todas as filas do pg-boss.
 * Roda como processo separado (npx tsx worker/index.ts) — no Render, um
 * Background Worker; localmente, um terminal ao lado do next dev.
 */
async function main() {
  const log = createLogger("worker");
  const boss = await getBoss();

  function register<N extends QueueName>(
    queue: N,
    handler: (data: QueuePayloads[N], log: ReturnType<typeof createLogger>) => Promise<void>,
    options: { retryLimit?: number } = {},
  ) {
    void boss.work<QueuePayloads[N]>(
      queue,
      { batchSize: 1, ...options },
      async (jobs) => {
        for (const job of jobs) {
          const jobLog = createLogger(job.id.slice(0, 8), { queue });
          jobLog.info("job iniciado");
          try {
            await handler(job.data, jobLog);
            jobLog.info("job concluído");
          } catch (e) {
            jobLog.error("job falhou", { err: String(e) });
            throw e; // deixa o pg-boss aplicar retry/backoff
          }
        }
      },
    );
  }

  register(QUEUE.email, handleEmail);
  register(QUEUE.whatsappInbound, handleWhatsappInbound);
  register(QUEUE.whatsappSend, handleWhatsappSend);
  register(QUEUE.ingestion, handleIngestion);
  register(QUEUE.triage, handleTriage);

  log.info("worker no ar", { queues: Object.values(QUEUE) });

  async function shutdown(signal: string) {
    log.info("encerrando", { signal });
    await boss.stop({ graceful: true, timeout: 15_000 });
    process.exit(0);
  }
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
