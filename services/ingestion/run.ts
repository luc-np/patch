import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  projects,
  documents,
  documentChunks,
  ingestionRuns,
  projectNotes,
  tickets,
  type IngestionStats,
} from "@/db/schema";
import { getEnv } from "@/lib/env";
import { getAiProvider } from "@/lib/ai/provider";
import type { Logger } from "@/lib/logger";
import { shouldSkipPath, shouldSkipContent } from "./filters";
import { isForbiddenPath, scrubContent } from "./scrub";
import { chunkFile, type Chunk } from "./chunking";
import { readCommitHistory, updateOwnership } from "./ownership";

const REPOS_DIR = "/tmp/patch-repos";

/** Sincroniza um projeto: repo git + notas + chamados resolvidos → índice. */
export async function runIngestion(projectId: string, log: Logger): Promise<void> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    log.warn("projeto não existe mais, ignorando", { projectId });
    return;
  }

  const [run] = await db
    .insert(ingestionRuns)
    .values({ projectId, status: "running" })
    .returning();
  if (!run) return;

  const stats: IngestionStats = {
    filesScanned: 0,
    filesIndexed: 0,
    filesSkipped: 0,
    chunksEmbedded: 0,
    discarded: [],
  };

  try {
    let toSha: string | null = null;
    let fromSha: string | null = null;

    if (project.repoUrl) {
      const lastSuccess = await db.query.ingestionRuns.findFirst({
        where: and(
          eq(ingestionRuns.projectId, projectId),
          eq(ingestionRuns.status, "success"),
        ),
        orderBy: [desc(ingestionRuns.startedAt)],
      });
      fromSha = lastSuccess?.toSha ?? null;

      const { git, workdir } = await syncRepo(project.repoUrl, projectId, project.defaultBranch, log);
      toSha = (await git.revparse(["HEAD"])).trim();

      const changed = await listChangedFiles(git, fromSha, toSha);
      log.info("arquivos a processar", { count: changed.upserts.length, deleted: changed.deletions.length });

      await ingestRepoFiles(projectId, workdir, toSha, changed.upserts, stats, log);
      await removeDocuments(projectId, "repo_file", changed.deletions);

      const commits = await readCommitHistory(git, fromSha);
      await updateOwnership(projectId, commits, log);
    }

    await ingestProjectNotes(projectId, stats);
    await ingestResolvedTickets(projectId, stats);

    await db
      .update(ingestionRuns)
      .set({
        status: "success",
        fromSha,
        toSha,
        stats,
        finishedAt: new Date(),
      })
      .where(eq(ingestionRuns.id, run.id));
    log.info("ingestão concluída", { ...stats, discarded: stats.discarded.length });
  } catch (e) {
    await db
      .update(ingestionRuns)
      .set({ status: "failed", error: String(e), stats, finishedAt: new Date() })
      .where(eq(ingestionRuns.id, run.id));
    throw e;
  }
}

/** Clone parcial (ou fetch) em disco efêmero — sobrevive a workdir apagado. */
async function syncRepo(
  repoUrl: string,
  projectId: string,
  branch: string,
  log: Logger,
): Promise<{ git: SimpleGit; workdir: string }> {
  await mkdir(REPOS_DIR, { recursive: true });
  const workdir = path.join(REPOS_DIR, projectId);

  if (existsSync(path.join(workdir, ".git"))) {
    const git = simpleGit(workdir);
    await git.fetch("origin", branch);
    await git.checkout(branch);
    await git.reset(["--hard", `origin/${branch}`]);
    log.info("fetch incremental", { workdir });
    return { git, workdir };
  }

  // --filter=blob:none: barato como shallow, mas preserva o histórico
  // completo de commits para o code_ownership.
  await simpleGit().clone(repoUrl, workdir, [
    "--filter=blob:none",
    "--branch",
    branch,
    "--single-branch",
  ]);
  log.info("clone parcial feito", { workdir });
  return { git: simpleGit(workdir), workdir };
}

async function listChangedFiles(
  git: SimpleGit,
  fromSha: string | null,
  toSha: string,
): Promise<{ upserts: string[]; deletions: string[] }> {
  if (!fromSha) {
    const all = (await git.raw(["ls-files"])).split("\n").filter(Boolean);
    return { upserts: all, deletions: [] };
  }
  if (fromSha === toSha) return { upserts: [], deletions: [] };

  const diff = await git.raw(["diff", "--name-status", `${fromSha}..${toSha}`]);
  const upserts: string[] = [];
  const deletions: string[] = [];
  for (const line of diff.split("\n")) {
    const [status, ...rest] = line.split("\t");
    if (!status || rest.length === 0) continue;
    const file = rest[rest.length - 1];
    if (!file) continue;
    if (status.startsWith("D")) deletions.push(file);
    else upserts.push(file);
    // Rename (R100 old new): o old também sai do índice.
    if (status.startsWith("R") && rest[0]) deletions.push(rest[0]);
  }
  return { upserts, deletions };
}

async function ingestRepoFiles(
  projectId: string,
  workdir: string,
  gitSha: string,
  files: string[],
  stats: IngestionStats,
  log: Logger,
): Promise<void> {
  const maxBytes = getEnv().MAX_FILE_BYTES;

  for (const file of files) {
    stats.filesScanned += 1;

    if (isForbiddenPath(file)) {
      stats.discarded.push({ path: file, reason: "caminho proibido (.env/chave)" });
      continue;
    }
    const skipReason = shouldSkipPath(file);
    if (skipReason) {
      stats.filesSkipped += 1;
      continue;
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(path.join(workdir, file));
    } catch {
      stats.filesSkipped += 1;
      continue;
    }
    const contentSkip = shouldSkipContent(buffer, maxBytes);
    if (contentSkip) {
      stats.filesSkipped += 1;
      continue;
    }

    const content = buffer.toString("utf8");
    const verdict = scrubContent(content);
    if (!verdict.clean) {
      stats.discarded.push({ path: file, reason: verdict.reason });
      log.warn("arquivo descartado pelo scrub", { file, reason: verdict.reason });
      continue;
    }

    const contentHash = sha256(content);
    const existing = await db.query.documents.findFirst({
      where: and(
        eq(documents.projectId, projectId),
        eq(documents.source, "repo_file"),
        eq(documents.path, file),
      ),
    });

    if (existing && existing.contentHash === contentHash) {
      // Conteúdo idêntico: só atualiza o sha — embedding custa dinheiro.
      await db
        .update(documents)
        .set({ gitSha, updatedAt: new Date() })
        .where(eq(documents.id, existing.id));
      continue;
    }

    const chunks = chunkFile(file, content);
    await upsertDocument(
      projectId,
      "repo_file",
      file,
      contentHash,
      gitSha,
      chunks,
      stats,
    );
    stats.filesIndexed += 1;
  }
}

async function ingestProjectNotes(
  projectId: string,
  stats: IngestionStats,
): Promise<void> {
  const notes = await db.query.projectNotes.findMany({
    where: eq(projectNotes.projectId, projectId),
  });
  for (const note of notes) {
    const text = `# ${note.title}\n\n${note.body}`;
    const contentHash = sha256(text);
    const docPath = `note:${note.id}`;
    const existing = await db.query.documents.findFirst({
      where: and(
        eq(documents.projectId, projectId),
        eq(documents.source, "project_note"),
        eq(documents.path, docPath),
      ),
    });
    if (existing && existing.contentHash === contentHash) continue;

    // Nota é informação que SÓ existe no app — o metadado marca isso.
    const chunks: Chunk[] = [
      { text, metadata: { kind: "project_note", path: docPath } },
    ];
    await upsertDocument(projectId, "project_note", docPath, contentHash, null, chunks, stats);
  }
}

async function ingestResolvedTickets(
  projectId: string,
  stats: IngestionStats,
): Promise<void> {
  const resolved = await db.query.tickets.findMany({
    where: and(eq(tickets.projectId, projectId), eq(tickets.status, "resolved")),
  });
  for (const ticket of resolved) {
    const text = `Chamado resolvido: ${ticket.title}\n\n${ticket.body}\n\nResolução: ${ticket.resolution ?? "não registrada"}`;
    const contentHash = sha256(text);
    const docPath = `ticket:${ticket.id}`;
    const existing = await db.query.documents.findFirst({
      where: and(
        eq(documents.projectId, projectId),
        eq(documents.source, "ticket"),
        eq(documents.path, docPath),
      ),
    });
    if (existing && existing.contentHash === contentHash) continue;

    const chunks: Chunk[] = [{ text, metadata: { kind: "ticket", path: docPath } }];
    await upsertDocument(projectId, "ticket", docPath, contentHash, null, chunks, stats);
  }
}

async function upsertDocument(
  projectId: string,
  source: "repo_file" | "project_note" | "ticket",
  docPath: string,
  contentHash: string,
  gitSha: string | null,
  chunks: Chunk[],
  stats: IngestionStats,
): Promise<void> {
  const [doc] = await db
    .insert(documents)
    .values({ projectId, source, path: docPath, contentHash, gitSha, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [documents.projectId, documents.source, documents.path],
      set: { contentHash, gitSha, updatedAt: new Date() },
    })
    .returning();
  if (!doc) return;

  await db.delete(documentChunks).where(eq(documentChunks.documentId, doc.id));
  if (chunks.length === 0) return;

  const embeddings = await getAiProvider().embed(
    chunks.map((c) => c.text),
    { inputType: "document" },
  );

  await db.insert(documentChunks).values(
    chunks.map((chunk, i) => ({
      documentId: doc.id,
      chunkIndex: i,
      text: chunk.text,
      embedding: embeddings[i] ?? [],
      metadata: chunk.metadata,
    })),
  );
  stats.chunksEmbedded += chunks.length;
}

async function removeDocuments(
  projectId: string,
  source: "repo_file",
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  await db
    .delete(documents)
    .where(
      and(
        eq(documents.projectId, projectId),
        eq(documents.source, source),
        inArray(documents.path, paths),
      ),
    );
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
