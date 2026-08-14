"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SuggestionEvidence } from "@/db/schema";

/** Trecho de código: uma div white-space:pre por linha, numerada. */
export function CodeExcerpt({
  from,
  lines,
}: {
  from: number;
  lines: string[];
}) {
  return (
    <div className="mt-1 mb-2 overflow-x-auto border border-border bg-card px-3 py-2 font-mono text-[11px] leading-[1.6]">
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre">
          <span className="mr-3 inline-block w-8 text-right text-muted-foreground tnum select-none">
            {from + i}
          </span>
          <span
            className={
              /(\/\/|#|\/\*|\*)/.test(line.trimStart().slice(0, 2))
                ? "text-ai-strong"
                : undefined
            }
          >
            {line || " "}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Linha de evidência: grid minmax(0,1fr) auto; a primeira expande o trecho. */
export function EvidenceRow({
  evidence,
  defaultExpanded = false,
}: {
  evidence: SuggestionEvidence;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const expandable = Boolean(evidence.excerpt);
  const lineRange =
    evidence.startLine != null && evidence.endLine != null
      ? `L${evidence.startLine}–${evidence.endLine}`
      : "";

  const row = (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
      <span className="min-w-0">
        <span
          className="block truncate font-mono text-[12px]"
          title={evidence.path}
        >
          {expandable && (
            <span className="mr-1 inline-block w-3 text-muted-foreground">
              {expanded ? "▾" : "▸"}
            </span>
          )}
          {evidence.path}
        </span>
        <span className="block font-mono text-[10.5px] text-muted-foreground">
          {evidence.reason}
        </span>
      </span>
      <span className="font-mono text-[10.5px] text-muted-foreground tnum">
        {lineRange}
      </span>
    </div>
  );

  return (
    <div className="py-1.5">
      {expandable ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={cn("block w-full text-left", "hover:bg-row-hover")}
          aria-expanded={expanded}
        >
          {row}
        </button>
      ) : (
        row
      )}
      {expanded && evidence.excerpt && (
        <CodeExcerpt
          from={evidence.startLine ?? 1}
          lines={evidence.excerpt.split("\n")}
        />
      )}
    </div>
  );
}
