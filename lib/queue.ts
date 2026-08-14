import { PgBoss } from "pg-boss";
import { getEnv } from "@/lib/env";

/** Nomes de fila e tipos de payload — o contrato entre o web e o worker. */
export const QUEUE = {
  triage: "triage",
  ingestion: "ingestion",
  email: "email",
  whatsappInbound: "whatsapp-inbound",
  whatsappSend: "whatsapp-send",
} as const;

export type QueuePayloads = {
  [QUEUE.triage]: { ticketId: string; correlationId: string };
  [QUEUE.ingestion]: { projectId: string };
  [QUEUE.email]: { to: string; subject: string; text: string };
  [QUEUE.whatsappInbound]: {
    messageId: string;
    from: string;
    text: string;
    timestamp: number;
  };
  [QUEUE.whatsappSend]: { ticketMessageId: string };
};

export type QueueName = keyof QueuePayloads;

const globalForBoss = globalThis as unknown as {
  __patchBoss?: PgBoss;
  __patchBossStarted?: Promise<PgBoss>;
};

/** Singleton lazy — o web só enfileira; quem processa é o worker. */
export async function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.__patchBossStarted) {
    const boss = new PgBoss({
      connectionString: getEnv().DATABASE_URL,
      schema: "pgboss",
    });
    boss.on("error", (err) => {
      console.error(JSON.stringify({ level: "error", msg: "pg-boss", err: String(err) }));
    });
    globalForBoss.__patchBoss = boss;
    globalForBoss.__patchBossStarted = boss.start().then(async (b) => {
      for (const name of Object.values(QUEUE)) {
        await b.createQueue(name);
      }
      return b;
    });
  }
  return globalForBoss.__patchBossStarted;
}

type EnqueueOptions = {
  singletonKey?: string;
  retryLimit?: number;
  retryBackoff?: boolean;
  startAfter?: number;
};

export async function enqueue<N extends QueueName>(
  queue: N,
  data: QueuePayloads[N],
  options: EnqueueOptions = {},
): Promise<string | null> {
  const boss = await getBoss();
  return boss.send(queue, data, options);
}
