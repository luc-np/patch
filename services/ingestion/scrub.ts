/**
 * Scrub de segredos — roda ANTES de qualquer chamada externa.
 * Arquivo com match é DESCARTADO por inteiro (não mascarado) e o descarte
 * fica registrado em ingestion_runs. Falso positivo custa um arquivo fora do
 * índice; falso negativo custa um segredo num provedor externo.
 */

export type ScrubVerdict = { clean: true } | { clean: false; reason: string };

/** .env e derivados nunca são lidos, muito menos indexados. */
export function isForbiddenPath(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  if (/^\.env(\..+)?$/.test(base)) return true;
  if (/\.(pem|key|p12|pfx|keystore|jks)$/i.test(base)) return true;
  if (/^(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/.test(base)) return true;
  if (/credentials(\.json)?$/i.test(base)) return true;
  return false;
}

const SECRET_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "chave AWS", regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "token GitHub", regex: /\b(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{20,}\b/ },
  { name: "chave Anthropic", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: "chave OpenAI", regex: /\bsk-[A-Za-z0-9]{40,}\b/ },
  { name: "token Slack", regex: /\bxox[bpoas]-[A-Za-z0-9-]{10,}\b/ },
  { name: "chave Google", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "chave Stripe", regex: /\b[sr]k_live_[A-Za-z0-9]{20,}\b/ },
  { name: "chave privada", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: "connection string com senha",
    regex: /\b[a-z][a-z0-9+.-]*:\/\/[^:\/\s]+:[^@\/\s]{4,}@[^\s"']+/i,
  },
  { name: "token JWT", regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

/** Entropia de Shannon em bits por caractere. */
export function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

const ENTROPY_TOKEN = /[A-Za-z0-9+/=_-]{28,}/g;
const ENTROPY_THRESHOLD = 4.8;

/** Contextos que denunciam atribuição de segredo perto do token. */
const ASSIGNMENT_HINT =
  /(secret|token|password|passwd|api[_-]?key|private|credential|auth)/i;

export function scrubContent(text: string): ScrubVerdict {
  for (const { name, regex } of SECRET_PATTERNS) {
    if (regex.test(text)) return { clean: false, reason: name };
  }

  // Entropia: token longo e denso perto de um nome suspeito.
  const lines = text.split("\n");
  for (const line of lines) {
    const tokens = line.match(ENTROPY_TOKEN);
    if (!tokens) continue;
    for (const token of tokens) {
      if (shannonEntropy(token) > ENTROPY_THRESHOLD && ASSIGNMENT_HINT.test(line)) {
        return { clean: false, reason: "token de alta entropia" };
      }
    }
  }
  return { clean: true };
}
