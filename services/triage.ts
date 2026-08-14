import picomatch from "picomatch";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  tickets,
  users,
  projectMembers,
  expertiseAreas,
  memberExpertise,
  codeOwnership,
  assignmentSuggestions,
  ingestionRuns,
} from "@/db/schema";
import { getEnv } from "@/lib/env";
import { getAiProvider, type TriageCandidate } from "@/lib/ai/provider";
import { hybridSearch } from "@/services/search";
import { logAudit } from "@/lib/audit";
import type { Logger } from "@/lib/logger";

const OWNERSHIP_HALF_LIFE_DAYS = 180;

export type GatedSuggestion = {
  suggestedUserId: string | null;
  confidence: number;
  rationale: string;
  improvements: string[];
};

/**
 * Gate de confiança — puro e testável. Uma sugestão só passa se: o id existe
 * entre os candidatos válidos E a confiança está acima do limite. Caso
 * contrário vira "sem sugestão", com explicação e ações concretas.
 */
export function applyConfidenceGate(
  suggestion: {
    suggestedUserId: string | null;
    confidence: number;
    rationale: string;
    improvements: string[];
  },
  validIds: Set<string>,
  minConfidence: number,
): GatedSuggestion {
  let { suggestedUserId, confidence, rationale } = suggestion;
  let improvements = [...suggestion.improvements];

  if (suggestedUserId && !validIds.has(suggestedUserId)) {
    suggestedUserId = null;
    confidence = 0;
    rationale =
      "A análise não convergiu para nenhum membro do time com sinal verificável.";
  }
  if (suggestedUserId && confidence < minConfidence) {
    rationale = `O sinal mais forte (${rationale}) ficou abaixo do limite de confiança configurado. Prefiro dizer isso a chutar um nome.`;
    suggestedUserId = null;
  }
  if (!suggestedUserId && improvements.length === 0) {
    improvements = [
      "Reindexar o repositório do projeto para atualizar o histórico de commits",
      "Declarar áreas de expertise com globs cobrindo os arquivos deste chamado",
    ];
  }
  return { suggestedUserId, confidence, rationale, improvements };
}

function decay(lastCommitAt: Date | null): number {
  if (!lastCommitAt) return 0.3;
  const ageDays = (Date.now() - lastCommitAt.getTime()) / 86_400_000;
  return Math.pow(0.5, ageDays / OWNERSHIP_HALF_LIFE_DAYS);
}

/**
 * Triagem de um chamado: recuperação híbrida → candidatos determinísticos →
 * LLM produz UMA sugestão (ou nenhuma) → gate de confiança → registro.
 * Nunca atribui — a decisão é sempre humana.
 */
export async function runTriage(ticketId: string, log: Logger): Promise<void> {
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket) {
    log.warn("ticket não existe mais", { ticketId });
    return;
  }
  if (ticket.assigneeId) {
    log.info("ticket já tem responsável, triagem dispensada", { ticketId });
    return;
  }

  // 1. Contexto relevante via busca híbrida
  const query = `${ticket.title}\n${ticket.body}`.slice(0, 4000);
  const hits = await hybridSearch({ projectId: ticket.projectId, query, limit: 12 });
  log.info("contexto recuperado", { hits: hits.length });

  // 2. Candidatos determinísticos: só membros staff do projeto
  const members = await db
    .select({ userId: projectMembers.userId, name: users.name, role: users.role })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, ticket.projectId));
  const staff = members.filter((m) => m.role !== "guest");

  const candidates = await buildCandidates(ticket.projectId, staff, hits);

  // 3. Uma chamada ao modelo, com o conteúdo do chamado delimitado
  const suggestion = await getAiProvider().generateTriage({
    ticketTitle: ticket.title,
    ticketBody: ticket.body,
    chunks: hits
      .filter((h) => h.source === "repo_file")
      .map((h) => ({
        path: h.path,
        text: h.text,
        startLine: h.metadata.startLine,
        endLine: h.metadata.endLine,
      })),
    candidates,
  });

  // 4. Gate: null, abaixo do limite ou id inventado → sugestão vazia e honesta
  const gated = applyConfidenceGate(
    suggestion,
    new Set(candidates.map((c) => c.userId)),
    getEnv().TRIAGE_CONFIDENCE_MIN,
  );
  const { suggestedUserId, confidence, rationale, improvements } = gated;
  if (suggestedUserId !== suggestion.suggestedUserId) {
    log.info("gate rebaixou a sugestão", {
      original: suggestion.suggestedUserId,
      confidence: suggestion.confidence,
    });
  }

  // 5. Estado do índice usado (procedência da sugestão)
  const lastRun = await db.query.ingestionRuns.findFirst({
    where: and(
      eq(ingestionRuns.projectId, ticket.projectId),
      eq(ingestionRuns.status, "success"),
    ),
    orderBy: (r, { desc }) => [desc(r.startedAt)],
  });

  // Evidência ganha o trecho real vindo do índice (a UI expande o código)
  const evidence = suggestion.evidence.map((e) => {
    if (e.excerpt) return e;
    const hit = hits.find((h) => h.metadata.path === e.path);
    if (!hit) return e;
    return {
      ...e,
      startLine: e.startLine ?? hit.metadata.startLine,
      endLine: e.endLine ?? hit.metadata.endLine,
      excerpt: hit.text.split("\n").slice(0, 8).join("\n"),
    };
  });

  // 6. SEMPRE grava — inclusive a sugestão vazia; é o que permite medir acerto
  const [saved] = await db
    .insert(assignmentSuggestions)
    .values({
      ticketId,
      suggestedUserId,
      confidence,
      rationale,
      evidence,
      improvements,
      model: suggestion.model,
      indexedAt: lastRun?.finishedAt ?? null,
    })
    .returning();

  await logAudit({
    actorKind: "ai",
    action: "suggestion.created",
    entityType: "ticket",
    entityId: ticketId,
    metadata: {
      suggestionId: saved?.id,
      suggestedUserId,
      confidence,
    },
  });
  log.info("sugestão registrada", { suggestedUserId, confidence });
}

async function buildCandidates(
  projectId: string,
  staff: { userId: string; name: string }[],
  hits: Awaited<ReturnType<typeof hybridSearch>>,
): Promise<TriageCandidate[]> {
  if (staff.length === 0) return [];
  const staffIds = staff.map((s) => s.userId);
  const nameById = new Map(staff.map((s) => [s.userId, s.name]));

  const paths = [
    ...new Set(
      hits.filter((h) => h.source === "repo_file").map((h) => h.metadata.path),
    ),
  ];

  const signals = new Map<string, { score: number; texts: string[] }>();
  function addSignal(userId: string, score: number, text: string) {
    const entry = signals.get(userId) ?? { score: 0, texts: [] };
    entry.score += score;
    entry.texts.push(text);
    signals.set(userId, entry);
  }

  // Sinal 1: code_ownership nos arquivos recuperados (com decaimento temporal)
  if (paths.length > 0) {
    const ownership = await db
      .select()
      .from(codeOwnership)
      .where(
        and(
          eq(codeOwnership.projectId, projectId),
          inArray(codeOwnership.path, paths),
          inArray(codeOwnership.userId, staffIds),
        ),
      );
    const byPath = new Map<string, typeof ownership>();
    for (const row of ownership) {
      const list = byPath.get(row.path) ?? [];
      list.push(row);
      byPath.set(row.path, list);
    }
    for (const [path, rows] of byPath) {
      const total = rows.reduce((s, r) => s + r.commitCount, 0);
      for (const row of rows) {
        if (!row.userId) continue;
        addSignal(
          row.userId,
          row.commitCount * decay(row.lastCommitAt),
          `${row.commitCount} de ${total} commits em ${path}`,
        );
      }
    }
  }

  // Sinal 2: expertise por área (declarada pesa 2x a inferida)
  const areas = await db.query.expertiseAreas.findMany({
    where: eq(expertiseAreas.projectId, projectId),
  });
  const matchedAreas = areas.filter(
    (a) => a.globs.length > 0 && paths.some((p) => picomatch(a.globs)(p)),
  );
  if (matchedAreas.length > 0) {
    const expertise = await db
      .select()
      .from(memberExpertise)
      .where(
        and(
          inArray(
            memberExpertise.areaId,
            matchedAreas.map((a) => a.id),
          ),
          inArray(memberExpertise.userId, staffIds),
        ),
      );
    const areaName = new Map(matchedAreas.map((a) => [a.id, a.name]));
    for (const row of expertise) {
      const weight = row.source === "manual" ? 2.0 : 1.0;
      addSignal(
        row.userId,
        row.weight * weight * 5,
        `área "${areaName.get(row.areaId)}" (${row.source === "manual" ? "declarada" : "inferida do git"}, peso ${row.weight.toFixed(2)})`,
      );
    }
  }

  const maxScore = Math.max(1, ...[...signals.values()].map((s) => s.score));
  return staff.map((s) => {
    const signal = signals.get(s.userId);
    return {
      userId: s.userId,
      name: nameById.get(s.userId) ?? s.userId,
      score: (signal?.score ?? 0) / maxScore,
      signals: signal?.texts.slice(0, 6) ?? [],
    };
  });
}
