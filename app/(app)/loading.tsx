import { QUEUE_GRID } from "@/components/patch/queue/grid";

/** Skeleton com a MESMA grade da tabela final; pulse desligado sob prefers-reduced-motion. */
export default function QueueLoading() {
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-[214px] shrink-0 border-r-2 border-rule p-3">
        <div className="h-7 animate-pulse bg-muted" />
        <div className="mt-4 space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[27px] animate-pulse bg-muted" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-4 py-2.5">
          <div className="h-5 w-40 animate-pulse bg-muted" />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="h-7 border-b-2 border-rule" />
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="grid h-[var(--row-h)] items-center border-b border-border px-2"
              style={{ gridTemplateColumns: QUEUE_GRID }}
            >
              <span />
              <div className="h-3 w-12 animate-pulse bg-muted" />
              <div className="h-3 w-3/4 animate-pulse bg-muted" />
              <div className="h-3 w-16 animate-pulse bg-muted" />
              <div className="h-3 w-12 animate-pulse bg-muted" />
              <div className="h-3 w-24 animate-pulse bg-muted" />
              <div className="h-3 w-16 animate-pulse bg-muted" />
              <div className="ml-auto h-3 w-10 animate-pulse bg-muted" />
            </div>
          ))}
          <p className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
            carregando chamados…
          </p>
        </div>
      </div>
    </div>
  );
}
