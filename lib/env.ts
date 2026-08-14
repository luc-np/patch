import { z } from "zod";

/**
 * Fronteira única com process.env — o app falha cedo e com mensagem clara.
 * Só importe deste módulo em código de servidor (web, worker, scripts).
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),

  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),

  SMTP_URL: z.string().min(1),
  EMAIL_FROM: z.string().default("Patch <patch@localhost>"),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5"),
  VOYAGE_API_KEY: z.string().optional(),
  VOYAGE_MODEL: z.string().default("voyage-code-3"),
  TRIAGE_CONFIDENCE_MIN: z.coerce.number().default(0.55),

  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_DEFAULT_PROJECT_SLUG: z.string().optional(),

  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),

  MAX_FILE_BYTES: z.coerce.number().default(524288),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Variáveis de ambiente inválidas — ${detail}`);
  }
  cached = parsed.data;
  return cached;
}
