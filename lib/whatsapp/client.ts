import { getEnv } from "@/lib/env";
import { ok, err, type Result } from "@/lib/result";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export type WaSendError = "window_closed" | "send_failed" | "not_configured";

/** Envia texto livre — só funciona dentro da janela de 24h da Meta. */
export async function sendWhatsappText(
  toPhone: string,
  text: string,
): Promise<Result<{ waMessageId: string }, WaSendError>> {
  const env = getEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return err("not_configured", "WhatsApp não configurado neste ambiente.");
  }

  const res = await fetch(`${GRAPH_BASE}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body: text },
    }),
  });

  const payload = (await res.json().catch(() => null)) as {
    messages?: { id: string }[];
    error?: { code?: number; error_data?: { details?: string } };
  } | null;

  if (!res.ok || !payload?.messages?.[0]) {
    // 131047: fora da janela de 24h — precisa de template aprovado.
    if (payload?.error?.code === 131047) {
      return err("window_closed", "Fora da janela de 24h de atendimento.");
    }
    return err("send_failed", JSON.stringify(payload?.error ?? res.status));
  }
  return ok({ waMessageId: payload.messages[0].id });
}
