/**
 * Rate limit em memória (token bucket) — suficiente para 1 instância web.
 * Se o app escalar horizontalmente, trocar por tabela no Postgres.
 */
type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { allowed: boolean } {
  const now = Date.now();
  const refillPerMs = limit / windowMs;
  const bucket = buckets.get(key) ?? { tokens: limit, updatedAt: now };

  bucket.tokens = Math.min(limit, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return { allowed: false };
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);

  // Poda ocasional para não crescer sem limite.
  if (buckets.size > 10_000) {
    const cutoff = now - windowMs * 2;
    for (const [k, b] of buckets) if (b.updatedAt < cutoff) buckets.delete(k);
  }
  return { allowed: true };
}
