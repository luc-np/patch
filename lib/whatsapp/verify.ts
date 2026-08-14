import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica a assinatura X-Hub-Signature-256 da Meta sobre o corpo CRU.
 * Inválida = 401 antes de qualquer processamento.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}
