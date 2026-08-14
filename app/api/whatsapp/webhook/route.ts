import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { verifyWebhookSignature } from "@/lib/whatsapp/verify";
import { enqueue, QUEUE } from "@/lib/queue";
import { createLogger } from "@/lib/logger";

/** GET: verificação do webhook na configuração do app da Meta. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === getEnv().WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

const webhookSchema = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            messages: z
              .array(
                z.object({
                  id: z.string(),
                  from: z.string(),
                  timestamp: z.coerce.number(),
                  type: z.string(),
                  text: z.object({ body: z.string() }).optional(),
                }),
              )
              .optional(),
          }),
        }),
      ),
    }),
  ),
});

/**
 * POST: assinatura verificada sobre o corpo cru ANTES de qualquer parse;
 * depois só enfileira e responde 200 imediatamente — a Meta re-entrega em
 * timeout e o processamento é idempotente por message_id.
 */
export async function POST(req: Request) {
  const env = getEnv();
  if (!env.WHATSAPP_APP_SECRET) {
    return new Response("whatsapp não configurado", { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(rawBody, signature, env.WHATSAPP_APP_SECRET)) {
    return new Response("assinatura inválida", { status: 401 });
  }

  const log = createLogger(undefined, { source: "whatsapp-webhook" });
  const parsed = webhookSchema.safeParse(JSON.parse(rawBody));
  if (parsed.success) {
    for (const entry of parsed.data.entry) {
      for (const change of entry.changes) {
        for (const message of change.value.messages ?? []) {
          if (message.type !== "text" || !message.text) continue;
          await enqueue(
            QUEUE.whatsappInbound,
            {
              messageId: message.id,
              from: message.from,
              text: message.text.body,
              timestamp: message.timestamp,
            },
            { singletonKey: message.id, retryLimit: 3, retryBackoff: true },
          );
        }
      }
    }
  } else {
    // Status updates e outros eventos não são erro — só não nos interessam.
    log.info("payload sem mensagens de texto, ignorado");
  }

  return NextResponse.json({ ok: true });
}
