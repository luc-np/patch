import { eq, and, desc, sql, cosineDistance, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { documents, documentChunks, type ChunkMetadata } from "@/db/schema";
import { getAiProvider } from "@/lib/ai/provider";

export type SearchHit = {
  chunkId: string;
  documentId: string;
  path: string;
  source: "repo_file" | "project_note" | "ticket";
  text: string;
  metadata: ChunkMetadata;
  score: number;
};

type RankedRow = { chunkId: string };

/**
 * Reciprocal Rank Fusion: score = Σ 1/(k + posição). Puro e testável —
 * a ordem final não depende das escalas incompatíveis de cosseno e ts_rank.
 */
export function rrfFuse<T extends RankedRow>(
  lists: T[][],
  { k = 60, limit = 12 }: { k?: number; limit?: number } = {},
): { chunkId: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((row, index) => {
      scores.set(row.chunkId, (scores.get(row.chunkId) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores.entries()]
    .map(([chunkId, score]) => ({ chunkId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Busca híbrida: vetor (HNSW, cosseno) + full-text (tsvector), fundidas por RRF.
 * `projectId` é OBRIGATÓRIO — um projeto nunca recupera contexto de outro.
 */
export async function hybridSearch({
  projectId,
  query,
  limit = 12,
}: {
  projectId: string;
  query: string;
  limit?: number;
}): Promise<SearchHit[]> {
  if (!projectId) throw new Error("hybridSearch exige projectId");

  const [queryVector] = await getAiProvider().embed([query], { inputType: "query" });
  if (!queryVector) return [];

  const CANDIDATES = 30;

  const vectorRows = await db
    .select({ chunkId: documentChunks.id })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(eq(documents.projectId, projectId))
    .orderBy(cosineDistance(documentChunks.embedding, queryVector))
    .limit(CANDIDATES);

  const ftsQuery = sql`plainto_tsquery('simple', ${query})`;
  const ftsRows = await db
    .select({ chunkId: documentChunks.id })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(and(eq(documents.projectId, projectId), sql`${documentChunks.fts} @@ ${ftsQuery}`))
    .orderBy(desc(sql`ts_rank(${documentChunks.fts}, ${ftsQuery})`))
    .limit(CANDIDATES);

  const fused = rrfFuse([vectorRows, ftsRows], { limit });
  if (fused.length === 0) return [];

  const byId = new Map(fused.map((f) => [f.chunkId, f.score]));
  const rows = await db
    .select({
      chunkId: documentChunks.id,
      documentId: documents.id,
      path: documents.path,
      source: documents.source,
      text: documentChunks.text,
      metadata: documentChunks.metadata,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(
      inArray(
        documentChunks.id,
        fused.map((f) => f.chunkId),
      ),
    );

  return rows
    .map((r) => ({ ...r, score: byId.get(r.chunkId) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}
