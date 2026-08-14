"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { ShortcutBar } from "@/components/patch/shortcut-bar";
import { QUEUE_GRID } from "@/components/patch/queue/grid";
import {
  formatTicketRef,
  formatShortTime,
  STATUS_LABEL,
  ORIGIN_LABEL,
} from "@/lib/format";
import type { QueueItem, QueueCounts, QueueView } from "@/services/tickets";
import type { ProjectSummary } from "@/services/projects";

const VIEW_LABEL: Record<QueueView, string> = {
  mine: "Minha fila",
  unassigned: "Sem responsável",
  suggested: "Sugestão pendente",
  due_today: "Vence hoje",
  all: "Tudo aberto",
};

const ORIGINS = ["portal", "whatsapp", "internal"] as const;

export type IndexStatus = {
  projectSlug: string;
  finishedAt: string;
  fileCount: number;
} | null;

export function QueueScreen({
  items,
  counts,
  projects,
  view,
  activeProjectSlug,
  indexStatus,
  resolvedTodayNote,
  title,
  createHref,
  createLabel,
  showRail = true,
  showOrigins = true,
  emptyNote,
}: {
  items: QueueItem[];
  counts: QueueCounts;
  projects: ProjectSummary[];
  view: QueueView;
  activeProjectSlug: string | null;
  indexStatus: IndexStatus;
  resolvedTodayNote: string | null;
  /** título fixo da área (Chamados/Tasks); sem ele, usa a visão ativa */
  title?: string;
  createHref?: string;
  createLabel?: string;
  showRail?: boolean;
  showOrigins?: boolean;
  emptyNote?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const originsParam = searchParams.get("origins");
  const activeOrigins = useMemo(
    () => (originsParam ? originsParam.split(",") : []),
    [originsParam],
  );

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleOrigin(origin: string) {
    const next = activeOrigins.includes(origin)
      ? activeOrigins.filter((o) => o !== origin)
      : [...activeOrigins, origin];
    setParam("origins", next.length > 0 ? next.join(",") : null);
  }

  const shortcuts = useMemo(
    () => ({
      j: () => setSelected((s) => (items.length === 0 ? 0 : (s + 1) % items.length)),
      k: () =>
        setSelected((s) =>
          items.length === 0 ? 0 : (s - 1 + items.length) % items.length,
        ),
      arrowdown: () =>
        setSelected((s) => (items.length === 0 ? 0 : (s + 1) % items.length)),
      arrowup: () =>
        setSelected((s) =>
          items.length === 0 ? 0 : (s - 1 + items.length) % items.length,
        ),
      enter: () => {
        const item = items[selected];
        if (item) router.push(`/tickets/${item.number}`);
      },
      "/": () => searchRef.current?.focus(),
    }),
    [items, selected, router],
  );
  useShortcuts(shortcuts);

  const selectedItem = items[selected];

  return (
    <div className="flex min-h-0 flex-1">
      {/* Rail esquerdo (só na Fila; Chamados/Tasks usam a toolbar) */}
      {showRail && (
      <aside className="flex w-[214px] shrink-0 flex-col border-r-2 border-rule">
        <div className="p-3">
          <div className="relative">
            <input
              ref={searchRef}
              placeholder="buscar"
              defaultValue={searchParams.get("q") ?? ""}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  setParam("q", e.currentTarget.value || null);
                if (e.key === "Escape") e.currentTarget.blur();
              }}
              className="h-7 w-full border border-input bg-background px-2 pr-6 text-[12.5px]"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 border border-border px-1 font-mono text-[10px] leading-[14px] text-muted-foreground">
              /
            </kbd>
          </div>
        </div>

        <nav className="px-3">
          <p className="kicker mb-1">visões</p>
          {(
            [
              ["mine", counts.mine],
              ["unassigned", counts.unassigned],
              ["suggested", counts.suggested],
              ["due_today", counts.dueToday],
            ] as [QueueView, number][]
          ).map(([v, n]) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setParam("view", v === "mine" ? null : v);
              }}
              className={cn(
                "flex h-[27px] w-full items-center justify-between px-2 text-[13px]",
                view === v && !activeProjectSlug
                  ? "bg-row-sel font-medium"
                  : "hover:bg-row-hover",
              )}
            >
              <span>{VIEW_LABEL[v]}</span>
              <span
                className={cn(
                  "font-mono text-[11px] tnum",
                  v === "suggested" && n > 0
                    ? "text-ai-strong"
                    : "text-muted-foreground",
                )}
              >
                {n}
              </span>
            </button>
          ))}
        </nav>

        <nav className="mt-4 px-3">
          <p className="kicker mb-1">projetos</p>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                setParam("project", activeProjectSlug === p.slug ? null : p.slug)
              }
              className={cn(
                "flex h-[27px] w-full items-center justify-between px-2 font-mono text-[12px]",
                activeProjectSlug === p.slug
                  ? "bg-row-sel font-medium"
                  : "hover:bg-row-hover",
              )}
            >
              <span className="truncate">{p.slug}</span>
              <span className="text-[11px] text-muted-foreground tnum">
                {p.openCount}
              </span>
            </button>
          ))}
        </nav>

        <div className="mt-auto border-t border-border p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
          {indexStatus ? (
            <>
              índice {indexStatus.projectSlug}
              <br />
              {indexStatus.finishedAt} · {indexStatus.fileCount} arq.
            </>
          ) : (
            <>índice ainda não construído</>
          )}
        </div>
      </aside>
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 py-2.5">
          <h1 className="text-[15px] font-extrabold tracking-tight">
            {title ??
              (activeProjectSlug ? (
                <Link
                  href={`/projects/${activeProjectSlug}`}
                  className="hover:underline hover:underline-offset-3"
                  title="Abrir a tela do projeto"
                >
                  {activeProjectSlug}
                </Link>
              ) : (
                VIEW_LABEL[view]
              ))}
          </h1>
          <span className="font-mono text-[11px] text-muted-foreground tnum">
            {items.length}
          </span>
          {showOrigins && (
            <div className="ml-4 flex items-center border border-border">
              {ORIGINS.map((o, i) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggleOrigin(o)}
                  className={cn(
                    "h-6 px-2 font-mono text-[11px]",
                    i > 0 && "border-l border-border",
                    activeOrigins.includes(o)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-row-hover",
                  )}
                >
                  {ORIGIN_LABEL[o]}
                </button>
              ))}
            </div>
          )}
          {!showRail && (
            <div className="relative ml-2">
              <input
                ref={searchRef}
                placeholder="buscar"
                defaultValue={searchParams.get("q") ?? ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    setParam("q", e.currentTarget.value || null);
                  if (e.key === "Escape") e.currentTarget.blur();
                }}
                className="h-7 w-48 border border-input bg-background px-2 pr-6 text-[12.5px]"
              />
              <kbd className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 border border-border px-1 font-mono text-[10px] leading-[14px] text-muted-foreground">
                /
              </kbd>
            </div>
          )}
          {createHref && createLabel && (
            <Link
              href={createHref}
              className="ml-auto flex h-7 items-center bg-primary px-3 text-[12.5px] font-medium text-primary-foreground"
            >
              {createLabel}
            </Link>
          )}
        </div>

        {/* Tabela */}
        <div className="min-h-0 flex-1 overflow-auto">
          <div
            className="sticky top-0 z-10 grid h-7 items-center border-b-2 border-rule bg-background px-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase"
            style={{ gridTemplateColumns: QUEUE_GRID }}
            role="row"
          >
            <span title="sugestão de IA">ia</span>
            <span>id</span>
            <span>título</span>
            <span>projeto</span>
            <span>origem</span>
            <span>responsável</span>
            <span>estado</span>
            <span className="text-right">atualizado</span>
          </div>

          {items.length === 0 ? (
            <EmptyQueue note={emptyNote ?? resolvedTodayNote} />
          ) : (
            items.map((item, i) => (
              <Link
                key={item.id}
                href={`/tickets/${item.number}`}
                onMouseEnter={() => setSelected(i)}
                className={cn(
                  "grid h-[var(--row-h)] items-center border-b border-border px-2 text-[13px]",
                  i === selected ? "bg-row-sel" : "hover:bg-row-hover",
                )}
                style={{ gridTemplateColumns: QUEUE_GRID }}
                role="row"
              >
                <span
                  className={cn(
                    item.hasPendingSuggestion
                      ? "text-ai"
                      : "text-muted-foreground",
                  )}
                  aria-label={
                    item.hasPendingSuggestion ? "sugestão pendente" : undefined
                  }
                >
                  {item.hasPendingSuggestion ? "◆" : "·"}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground tnum">
                  {formatTicketRef(item.number)}
                </span>
                <span
                  className={cn("truncate", i === selected && "font-semibold")}
                  title={item.title}
                >
                  {item.title}
                </span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {item.projectSlug}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {ORIGIN_LABEL[item.origin]}
                </span>
                <span className="truncate text-[12.5px]">
                  {item.assigneeName ? (
                    item.assigneeName
                  ) : item.suggestedName ? (
                    <span className="text-ai-strong">
                      sugerido: {item.suggestedName.split(" ")[0]}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">sem responsável</span>
                  )}
                </span>
                <span className="font-mono text-[11px] lowercase">
                  {STATUS_LABEL[item.status]}
                </span>
                <span
                  className={cn(
                    "text-right font-mono text-[11px] tnum",
                    item.dueToday ? "text-ai-strong" : "text-muted-foreground",
                  )}
                >
                  {item.dueToday ? "vence hoje" : formatShortTime(new Date(item.updatedAt))}
                </span>
              </Link>
            ))
          )}
        </div>

        <ShortcutBar
          shortcuts={[
            { keys: ["j", "k"], label: "mover" },
            { keys: ["enter"], label: "abrir" },
            { keys: ["a"], label: "aceitar sugestão" },
            { keys: ["i"], label: "nota interna" },
            { keys: ["/"], label: "buscar" },
            { keys: ["t"], label: "tema" },
          ]}
          right={
            items.length > 0
              ? `${Math.min(selected + 1, items.length)} de ${items.length}${
                  selectedItem ? ` · ${formatTicketRef(selectedItem.number)}` : ""
                }`
              : undefined
          }
        />
      </div>
    </div>
  );
}

function EmptyQueue({ note }: { note: string | null }) {
  return (
    <div className="px-8 py-16">
      <div className="h-0 w-14 border-t-2 border-rule" aria-hidden />
      <h2 className="mt-5 text-[26px]">Fila limpa.</h2>
      <p className="mt-3 max-w-[52ch] text-[14px] text-muted-foreground">
        {note ??
          "Nenhum chamado aberto nesta visão. Quando algo entrar, aparece aqui na hora."}
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/?view=all"
          className="flex h-8 items-center border border-input px-3 text-[13px] font-medium hover:bg-accent"
        >
          Ver tudo aberto
        </Link>
        <Link
          href="/tickets/new"
          className="flex h-8 items-center bg-primary px-3 text-[13px] font-medium text-primary-foreground"
        >
          Abrir task interna
        </Link>
      </div>
    </div>
  );
}
