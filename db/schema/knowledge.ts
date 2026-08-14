import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  jsonb,
  vector,
  customType,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { projects } from "./core";
import { documentSource, ingestionStatus } from "./enums";

/** Dimensão do embedding (voyage-code-3 com output_dimension 1024).
 *  Trocar de modelo exige migration + reindexação total — por isso vive num único lugar. */
export const EMBEDDING_DIMENSIONS = 1024;

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const projectNotes = pgTable(
  "project_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    updatedBy: text("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("project_notes_project_idx").on(t.projectId)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    source: documentSource("source").notNull(),
    /** caminho do arquivo no repo, ou "note:<id>" / "ticket:<id>" */
    path: text("path").notNull(),
    /** sha do commit indexado — o git é a fonte da verdade, nunca guardamos cópia divergente */
    gitSha: text("git_sha"),
    /** sha256 do conteúdo — dedup: o que não mudou não é reembedado */
    contentHash: text("content_hash").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("documents_project_source_path_uq").on(
      t.projectId,
      t.source,
      t.path,
    ),
  ],
);

export type ChunkMetadata = {
  kind: "code" | "markdown" | "project_note" | "ticket";
  path: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  headingTrail?: string[];
};

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    metadata: jsonb("metadata").$type<ChunkMetadata>().notNull(),
    /* Config 'simple': o conteúdo mistura pt-BR, inglês e código — stemming
       atrapalharia nome de função e código de erro. */
    fts: tsvector("fts").generatedAlwaysAs(
      (): ReturnType<typeof sql> => sql`to_tsvector('simple', "text")`,
    ),
  },
  (t) => [
    uniqueIndex("document_chunks_document_index_uq").on(
      t.documentId,
      t.chunkIndex,
    ),
    index("document_chunks_embedding_hnsw_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
    index("document_chunks_fts_gin_idx").using("gin", t.fts),
  ],
);

export type IngestionStats = {
  filesScanned: number;
  filesIndexed: number;
  filesSkipped: number;
  chunksEmbedded: number;
  discarded: { path: string; reason: string }[];
};

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fromSha: text("from_sha"),
    toSha: text("to_sha"),
    status: ingestionStatus("status").notNull().default("running"),
    stats: jsonb("stats").$type<IngestionStats | null>(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("ingestion_runs_project_started_idx").on(t.projectId, t.startedAt)],
);
