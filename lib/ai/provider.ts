import { getEnv } from "@/lib/env";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";
import type { SuggestionEvidence } from "@/db/schema";

/**
 * Toda chamada de LLM/embeddings passa por esta interface — trocar de modelo
 * é trocar a implementação aqui, sem tocar em services ou handlers.
 */

export type EmbedInputType = "document" | "query";

export type TriageCandidate = {
  userId: string;
  name: string;
  signals: string[]; // sinais numéricos já computados ("9 commits em src/checkout nos últimos 90d")
  score: number; // 0..1, determinístico
};

export type TriageContext = {
  ticketTitle: string;
  ticketBody: string;
  chunks: { path: string; text: string; startLine?: number; endLine?: number }[];
  candidates: TriageCandidate[];
};

export type TriageSuggestion = {
  suggestedUserId: string | null;
  confidence: number;
  rationale: string;
  evidence: SuggestionEvidence[];
  improvements: string[];
  model: string;
};

export type MarkdownEditRequest = {
  path: string;
  currentContent: string;
  instruction: string;
  ticketContext?: string;
};

export interface AiProvider {
  embed(texts: string[], opts: { inputType: EmbedInputType }): Promise<number[][]>;
  generateTriage(context: TriageContext): Promise<TriageSuggestion>;
  generateMarkdownEdit(request: MarkdownEditRequest): Promise<{ newContent: string }>;
}

export { EMBEDDING_DIMENSIONS };

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const env = getEnv();

  // Sem chaves em dev: embeddings determinísticos para exercitar o pipeline
  // localmente. Em produção a ausência de chave é erro, não fallback.
  if (!env.VOYAGE_API_KEY && env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "VOYAGE_API_KEY ausente — usando embeddings fake (apenas dev)",
      }),
    );
    cached = createDevProvider();
    return cached;
  }

  cached = createRealProvider();
  return cached;
}

function createRealProvider(): AiProvider {
  return {
    embed: (texts, opts) =>
      import("./voyage").then((m) => m.voyageEmbed(texts, opts)),
    generateTriage: (context) =>
      import("./anthropic").then((m) => m.generateTriage(context)),
    generateMarkdownEdit: (request) =>
      import("./anthropic").then((m) => m.generateMarkdownEdit(request)),
  };
}

function createDevProvider(): AiProvider {
  return {
    embed: (texts) => import("./fake").then((m) => m.fakeEmbed(texts)),
    generateTriage: (context) =>
      import("./anthropic").then((m) => m.generateTriage(context)),
    generateMarkdownEdit: (request) =>
      import("./anthropic").then((m) => m.generateMarkdownEdit(request)),
  };
}
