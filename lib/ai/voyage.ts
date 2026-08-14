import { getEnv } from "@/lib/env";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";
import type { EmbedInputType } from "./provider";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MAX_BATCH = 96;

/** Embeddings via Voyage AI (voyage-code-3), com batching e retry em 429. */
export async function voyageEmbed(
  texts: string[],
  opts: { inputType: EmbedInputType },
): Promise<number[][]> {
  const env = getEnv();
  if (!env.VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY ausente");

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH);
    out.push(...(await embedBatch(batch, opts.inputType, env.VOYAGE_API_KEY, env.VOYAGE_MODEL)));
  }
  return out;
}

async function embedBatch(
  batch: string[],
  inputType: EmbedInputType,
  apiKey: string,
  model: string,
  attempt = 0,
): Promise<number[][]> {
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: batch,
      input_type: inputType,
      output_dimension: EMBEDDING_DIMENSIONS,
    }),
  });

  if (res.status === 429 && attempt < 5) {
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    return embedBatch(batch, inputType, apiKey, model, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`voyage ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const payload = (await res.json()) as {
    data: { index: number; embedding: number[] }[];
  };
  return payload.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
