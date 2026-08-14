"use client";

import { useState, useTransition } from "react";
import { diffLines, collapseContext } from "@/lib/diff";
import type { MarkdownProposal } from "@/services/markdown-pr";
import {
  proposeMarkdownAction,
  openPrAction,
} from "@/app/(app)/tickets/[ref]/markdown-actions";

/**
 * Bloco `código` do rail direito: propor edição em .md e abrir PR.
 * Fluxo sempre: gerar diff → humano confirma → branch → PR → link.
 */
export function MarkdownPrPanel({
  ticketId,
  ticketNumber,
  defaultBranch,
  lastIndexedSha,
  hasRepo,
}: {
  ticketId: string;
  ticketNumber: number;
  defaultBranch: string;
  lastIndexedSha: string | null;
  hasRepo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<MarkdownProposal | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!hasRepo) return null;

  const suggestedBranch = proposal?.suggestedBranch ?? `patch/pt-${ticketNumber}`;

  function propose() {
    setError(null);
    startTransition(async () => {
      const res = await proposeMarkdownAction({ ticketId, path, instruction });
      if (!res.ok || !res.proposal) {
        setError(res.error ?? "Não deu para gerar a proposta.");
        return;
      }
      setProposal(res.proposal);
    });
  }

  function confirm() {
    if (!proposal) return;
    setError(null);
    startTransition(async () => {
      const res = await openPrAction({
        ticketId,
        path: proposal.path,
        newContent: proposal.newContent,
        fileSha: proposal.fileSha,
        baseSha: proposal.baseSha,
        branch: proposal.suggestedBranch,
      });
      if (!res.ok || !res.prUrl) {
        setError(res.error ?? "Não deu para abrir o PR.");
        return;
      }
      setPrUrl(res.prUrl);
      setProposal(null);
    });
  }

  return (
    <section className="border-t border-border p-4">
      <p className="kicker mb-2">código</p>
      <dl className="grid grid-cols-[78px_1fr] gap-y-1.5 text-[12.5px]">
        <dt className="text-muted-foreground">branch</dt>
        <dd className="truncate font-mono text-[11.5px]" title={suggestedBranch}>
          {suggestedBranch}
        </dd>
        <dt className="text-muted-foreground">base</dt>
        <dd className="font-mono text-[11.5px]">
          {defaultBranch}
          {lastIndexedSha ? ` · ${lastIndexedSha.slice(0, 8)}` : ""}
        </dd>
      </dl>

      {prUrl ? (
        <p className="mt-3 text-[12.5px]">
          PR aberto:{" "}
          <a href={prUrl} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">
            {prUrl.replace("https://github.com/", "")}
          </a>
        </p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex h-8 w-full items-center border border-input px-3 text-[12.5px] font-medium hover:bg-accent"
        >
          Propor edição em .md
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="docs/runbooks/exemplo.md"
            className="h-7 border border-input bg-background px-2 font-mono text-[11px]"
          />
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
            placeholder="O que deve mudar neste arquivo, a partir do que se aprendeu no chamado?"
            className="resize-y border border-input bg-background px-2 py-1.5 text-[12px]"
          />
          <button
            type="button"
            onClick={propose}
            disabled={pending || !path || instruction.length < 5}
            className="flex h-8 items-center border border-input px-3 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50"
          >
            {pending && !proposal ? "Gerando proposta…" : "Gerar diff para revisão"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-ai-strong">{error}</p>}

      {proposal && (
        <div className="mt-3">
          <p className="kicker mb-1">diff proposto · revise antes de abrir o PR</p>
          <div className="max-h-72 overflow-auto border border-border bg-card font-mono text-[10.5px] leading-[1.6]">
            {collapseContext(diffLines(proposal.currentContent, proposal.newContent)).map(
              (line, i) =>
                line.type === "skip" ? (
                  <div key={i} className="px-2 text-muted-foreground select-none">
                    ⋯ {line.count} linhas sem mudança
                  </div>
                ) : (
                  <div
                    key={i}
                    className="px-2 whitespace-pre-wrap"
                    style={
                      line.type === "del"
                        ? {
                            background:
                              "color-mix(in srgb, var(--ai) 12%, transparent)",
                            textDecoration: "line-through",
                          }
                        : line.type === "add"
                          ? {
                              background:
                                "color-mix(in srgb, var(--foreground) 8%, transparent)",
                            }
                          : undefined
                    }
                  >
                    {line.type === "del" ? "- " : line.type === "add" ? "+ " : "  "}
                    {line.text || " "}
                  </div>
                ),
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="flex h-8 items-center bg-primary px-3 text-[12.5px] font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Abrindo…" : "Criar branch e abrir PR"}
            </button>
            <button
              type="button"
              onClick={() => setProposal(null)}
              className="flex h-8 items-center px-2 text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
