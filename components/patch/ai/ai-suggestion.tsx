"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { formatDateTime, formatTime, isToday } from "@/lib/format";
import { EvidenceRow } from "./evidence";
import { ConfidenceSpine } from "./confidence-spine";
import type { SuggestionEvidence } from "@/db/schema";
import type { MemberItem } from "@/services/members";
import {
  decideSuggestionAction,
  undoSuggestionAction,
} from "@/app/(app)/tickets/[ref]/suggestion-actions";

export type SuggestionData = {
  id: string;
  suggestedUserId: string | null;
  suggestedUserName: string | null;
  confidence: number;
  rationale: string;
  evidence: SuggestionEvidence[];
  improvements: string[];
  model: string;
  indexedAt: string | null;
  decision: "pending" | "accepted" | "rejected";
  decidedAt: string | null;
  decidedByMe: boolean;
  createdAt: string;
};

/**
 * O bloco de sugestão da IA — decide sozinho entre os estados por faixa de
 * confiança: >= 0.70 alta · < 0.55 baixa · sem pessoa = ausente.
 * A diferença entre eles é quantidade de tinta e de evidência, não semáforo.
 */
export function AiSuggestion({
  suggestion,
  members,
  ticketId,
  currentAssigneeName,
}: {
  suggestion: SuggestionData | null;
  members: MemberItem[];
  ticketId: string;
  currentAssigneeName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<"accepted" | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const firstName = suggestion?.suggestedUserName?.split(" ")[0] ?? "";

  function accept() {
    if (!suggestion || suggestion.decision !== "pending" || pending) return;
    setOptimistic("accepted"); // otimista; rollback se a API falhar
    startTransition(async () => {
      const res = await decideSuggestionAction({
        suggestionId: suggestion.id,
        decision: "accepted",
      });
      if (!res.ok) setOptimistic(null);
      router.refresh();
    });
  }

  const shortcuts = useMemo(() => ({ a: accept }), [suggestion?.id, pending]); // eslint-disable-line react-hooks/exhaustive-deps
  useShortcuts(shortcuts, suggestion?.decision === "pending");

  function choose(userId: string) {
    if (!suggestion || pending) return;
    startTransition(async () => {
      await decideSuggestionAction({
        suggestionId: suggestion.id,
        decision: "rejected",
        chosenUserId: userId,
      });
      setChoosing(false);
      router.refresh();
    });
  }

  function ignore() {
    if (!suggestion || pending) return;
    startTransition(async () => {
      await decideSuggestionAction({
        suggestionId: suggestion.id,
        decision: "rejected",
      });
      router.refresh();
    });
  }

  function undo() {
    if (!suggestion || pending) return;
    setOptimistic(null);
    startTransition(async () => {
      await undoSuggestionAction({ suggestionId: suggestion.id });
      router.refresh();
    });
  }

  async function requestSuggestion() {
    setRequesting(true);
    await fetch(`/api/suggest/${ticketId}`, { method: "POST" });
    setTimeout(() => {
      setRequesting(false);
      router.refresh();
    }, 6000);
  }

  // ── Sem registro de sugestão ainda ──
  if (!suggestion) {
    return (
      <div className="mx-5 mt-5 border border-border p-4">
        <p className="kicker">patch</p>
        <p className="mt-2 text-[14px] text-muted-foreground">
          A triagem deste chamado ainda não rodou.
        </p>
        <button
          type="button"
          onClick={() => void requestSuggestion()}
          disabled={requesting}
          className="mt-3 flex h-8 items-center border border-input px-3 text-[13px] font-medium hover:bg-accent disabled:opacity-50"
        >
          {requesting ? "Analisando…" : "Pedir uma sugestão"}
        </button>
      </div>
    );
  }

  // ── Decidida: barra de 1px ──
  const decided = optimistic === "accepted" || suggestion.decision !== "pending";
  if (decided) {
    const accepted = optimistic === "accepted" || suggestion.decision === "accepted";
    const when = suggestion.decidedAt ? new Date(suggestion.decidedAt) : new Date();
    return (
      <div className="mx-5 mt-5 flex items-center gap-2 border border-border px-3 py-2 font-mono text-[11px]">
        <span className="text-muted-foreground">
          {accepted ? "atribuído" : "sugestão recusada"}
        </span>
        {accepted && suggestion.suggestedUserName && (
          <>
            <span>·</span>
            <span className="font-sans text-[12.5px] font-semibold">
              {suggestion.suggestedUserName}
            </span>
          </>
        )}
        <span>·</span>
        <span className="text-muted-foreground">
          {accepted ? "sugestão aceita" : currentAssigneeName ? `atribuído a ${currentAssigneeName}` : "sem atribuição"}
        </span>
        <span>·</span>
        <span className="text-muted-foreground tnum">
          {isToday(when) ? `hoje ${formatTime(when)}` : formatDateTime(when)}
        </span>
        {suggestion.decidedByMe || optimistic ? (
          <>
            <span>·</span>
            <span className="text-muted-foreground">por você</span>
          </>
        ) : null}
        <button
          type="button"
          onClick={undo}
          disabled={pending}
          className="ml-auto font-sans text-[12px] font-medium underline underline-offset-2 disabled:opacity-50"
        >
          Desfazer
        </button>
      </div>
    );
  }

  // ── Ausente: resposta honesta, não falha ──
  if (!suggestion.suggestedUserId) {
    return (
      <div className="mx-5 mt-5 border border-border p-5">
        <p className="kicker">
          Patch não sugere ninguém
          <Provenance suggestion={suggestion} />
        </p>
        <p className="mt-3 max-w-[62ch] text-[17px] font-semibold">
          Não encontrei evidência suficiente para sugerir alguém. Prefiro dizer
          isso a chutar um nome.
        </p>
        <p className="mt-2 max-w-[62ch] text-[13.5px] text-muted-foreground">
          {suggestion.rationale}
        </p>

        {suggestion.improvements.length > 0 && (
          <div className="mt-4">
            <p className="kicker">o que me deixaria útil aqui</p>
            <ol className="mt-1.5 space-y-1 font-mono text-[11.5px]">
              {suggestion.improvements.slice(0, 2).map((item, i) => (
                <li key={i}>
                  <span className="text-muted-foreground tnum">{i + 1}.</span>{" "}
                  {item}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-5">
          <p className="kicker">atribuir à mão</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.slice(0, 4).map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => choose(m.userId)}
                disabled={pending}
                className="flex h-[30px] items-center gap-2 border border-input px-3 text-[13px] font-medium hover:bg-accent disabled:opacity-50"
              >
                {m.name.split(" ")[0]}
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {m.role}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => void requestSuggestion()}
              disabled={requesting}
              className="flex h-[30px] items-center px-3 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {requesting ? "Reindexando…" : "Reindexar agora"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Com pessoa: alta (≥0.70) ou baixa (<0.55); o meio-termo é alta sem ostentação ──
  const high = suggestion.confidence >= 0.7;
  const low = suggestion.confidence < 0.55;

  return (
    <div
      className={cn(
        "mx-5 mt-5 p-5",
        high
          ? "border-2 border-ai"
          : low
            ? "border border-border bg-card"
            : "border border-ai",
      )}
      style={high ? { background: "var(--ai-faint)" } : undefined}
    >
      <div className="flex gap-5">
        <ConfidenceSpine value={suggestion.confidence} strong={!low} />

        <div className="min-w-0 flex-1">
          <p className="kicker">
            {low ? "Patch arrisca um palpite" : "Patch sugere"}
            <Provenance suggestion={suggestion} />
          </p>

          <p
            className={cn(
              "mt-1.5",
              low
                ? "text-[16px] font-semibold"
                : "text-[30px] font-extrabold tracking-tight",
            )}
          >
            {suggestion.suggestedUserName}
          </p>

          <p className="mt-2 max-w-[62ch] text-[14.5px]">{suggestion.rationale}</p>

          {/* Evidência — a maior parte do bloco */}
          <div
            className={cn(
              "mt-4 border-t-2 pt-2",
              low ? "border-border" : "border-ai",
            )}
          >
            {low && <p className="kicker mb-1">evidência rala</p>}
            {suggestion.evidence.slice(0, 4).map((e, i) => (
              <EvidenceRow key={i} evidence={e} defaultExpanded={i === 0} />
            ))}
            {suggestion.evidence.length === 0 && (
              <p className="py-2 font-mono text-[11px] text-muted-foreground">
                nenhum trecho citado
              </p>
            )}
          </div>

          {/* Ações — a inversão entre alta e baixa é deliberada */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {low ? (
              <>
                <button
                  type="button"
                  onClick={() => setChoosing((c) => !c)}
                  disabled={pending}
                  className="flex h-8 items-center border border-foreground px-3 text-[13px] font-semibold hover:bg-accent disabled:opacity-50"
                >
                  Escolher responsável
                </button>
                <button
                  type="button"
                  onClick={accept}
                  disabled={pending}
                  className="flex h-8 items-center border border-input px-3 text-[13px] font-medium hover:bg-accent disabled:opacity-50"
                >
                  Atribuir a {firstName} mesmo assim
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={accept}
                  disabled={pending}
                  className="flex h-8 items-center gap-2 bg-ai px-3 text-[13px] font-semibold text-ai-foreground hover:bg-ai-strong disabled:opacity-50"
                >
                  Aceitar e atribuir a {firstName}
                  <kbd className="border border-current px-1 font-mono text-[10px] leading-[14px]">
                    a
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setChoosing((c) => !c)}
                  disabled={pending}
                  className="flex h-8 items-center border border-input px-3 text-[13px] font-medium hover:bg-accent disabled:opacity-50"
                >
                  Escolher outra pessoa
                </button>
                <button
                  type="button"
                  onClick={ignore}
                  disabled={pending}
                  className="flex h-8 items-center px-3 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Ignorar sugestão
                </button>
              </>
            )}
            <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">
              sugestão, não decisão · nada é atribuído sem você
            </span>
          </div>

          {choosing && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {members.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => choose(m.userId)}
                  disabled={pending}
                  className="flex h-[30px] items-center gap-2 border border-input px-3 text-[13px] font-medium hover:bg-accent disabled:opacity-50"
                >
                  {m.name.split(" ")[0]}
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {m.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Provenance({ suggestion }: { suggestion: SuggestionData }) {
  return (
    <span className="ml-2 normal-case tracking-normal">
      {suggestion.model}
      {suggestion.indexedAt
        ? ` · índice de ${formatTime(new Date(suggestion.indexedAt))}`
        : " · sem índice"}
    </span>
  );
}
