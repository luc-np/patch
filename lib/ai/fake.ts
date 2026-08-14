import { createHash } from "node:crypto";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";

/**
 * Embedding determinístico por hash de trigramas — SÓ para desenvolvimento
 * sem chave da Voyage. Dá similaridade lexical grosseira, o suficiente para
 * exercitar o pipeline e a busca de ponta a ponta.
 */
export async function fakeEmbed(texts: string[]): Promise<number[][]> {
  return texts.map((text) => {
    const vec = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    const normalized = text.toLowerCase().replace(/\s+/g, " ");
    for (let i = 0; i < normalized.length - 2; i++) {
      const tri = normalized.slice(i, i + 3);
      const h = createHash("sha1").update(tri).digest();
      const idx = h.readUInt16BE(0) % EMBEDDING_DIMENSIONS;
      const sign = (h[2] ?? 0) % 2 === 0 ? 1 : -1;
      vec[idx] = (vec[idx] ?? 0) + sign;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  });
}
