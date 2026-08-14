import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import {
  getProjectBySlug,
  getLatestIngestion,
  getProjectStats,
  getUnownedFolders,
} from "@/services/projects";
import { listProjectNotes } from "@/services/notes";
import { listQueue } from "@/services/tickets";
import {
  formatTicketRef,
  formatDateTime,
  formatShortTime,
  STATUS_LABEL,
} from "@/lib/format";
import { ReindexButton, NotesEditor } from "./project-client";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const actor = await getActor();
  if (!actor || actor.role === "guest") redirect("/login");

  const { slug } = await params;
  const projectResult = await getProjectBySlug(actor, slug);
  if (!projectResult.ok) notFound();
  const project = projectResult.value;

  const [stats, ingestion, unowned, notesResult, queueResult] = await Promise.all([
    getProjectStats(project.id),
    getLatestIngestion(project.id),
    getUnownedFolders(project.id),
    listProjectNotes(actor, project.id),
    listQueue(actor, { view: "all", projectSlug: slug }),
  ]);
  const notes = notesResult.ok ? notesResult.value : [];
  const openTickets = queueResult.ok ? queueResult.value : [];

  const ingestionDuration =
    ingestion?.finishedAt && ingestion.startedAt
      ? Math.round(
          (ingestion.finishedAt.getTime() - ingestion.startedAt.getTime()) / 1000,
        )
      : null;

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {/* Cabeçalho */}
      <header className="flex items-center gap-4 px-6 pt-6 pb-4">
        <h1 className="text-[22px]">{project.name}</h1>
        {project.repoUrl && (
          <span
            className="truncate font-mono text-[11.5px] text-muted-foreground"
            title={project.repoUrl}
          >
            {project.repoUrl.replace(/^(https:\/\/|file:\/\/)/, "")}
          </span>
        )}
        <div className="ml-auto">
          <ReindexButton projectId={project.id} disabled={!project.repoUrl} />
        </div>
      </header>

      {/* Faixa de quatro números */}
      <div className="grid grid-cols-4 divide-x divide-border border-t border-b-2 border-t-border border-b-rule">
        <StatCell
          label="chamados abertos"
          value={String(stats.open)}
          detail={`${stats.unassigned} sem responsável`}
        />
        <StatCell
          label="1ª resposta mediana"
          value={
            stats.medianFirstResponseMin !== null
              ? formatMinutes(stats.medianFirstResponseMin)
              : "—"
          }
          detail="acordo 4h"
        />
        <StatCell
          label="sugestões aceitas"
          value={`${stats.suggestionsAccepted}/${stats.suggestionsDecided}`}
          detail={`${stats.suggestionsOverridden} trocadas à mão`}
        />
        <StatCell
          label="vence hoje"
          value={String(stats.dueToday.length)}
          detail={stats.dueToday.map((t) => formatTicketRef(t.number)).join(" ") || "—"}
          detailMono
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_320px]">
        {/* Chamados abertos */}
        <section className="border-r border-border">
          <p className="kicker px-6 pt-5 pb-2">chamados abertos</p>
          {openTickets.length === 0 ? (
            <p className="px-6 py-4 text-[13px] text-muted-foreground">
              Nenhum chamado aberto agora.
            </p>
          ) : (
            openTickets.map((t) => (
              <Link
                key={t.id}
                href={`/tickets/${t.number}`}
                className="grid h-9 grid-cols-[84px_minmax(90px,1fr)_auto] items-center gap-3 border-b border-border px-6 text-[13px] hover:bg-row-hover"
              >
                <span className="font-mono text-[11px] text-muted-foreground tnum">
                  {formatTicketRef(t.number)}
                </span>
                <span className="truncate" title={t.title}>
                  {t.title}
                </span>
                <span className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                  <span className="lowercase">{STATUS_LABEL[t.status]}</span>
                  <span className="tnum">
                    {t.dueToday ? (
                      <span className="text-ai-strong">vence hoje</span>
                    ) : (
                      formatShortTime(new Date(t.updatedAt))
                    )}
                  </span>
                </span>
              </Link>
            ))
          )}
        </section>

        {/* Rail direito */}
        <aside className="flex flex-col">
          <section className="border-b border-border p-5">
            <p className="kicker mb-2">repositório conectado</p>
            {project.repoUrl ? (
              <dl className="space-y-1.5 text-[12.5px]">
                <Row k="repo" v={project.repoUrl.replace(/^(https:\/\/|file:\/\/)/, "")} mono />
                <Row k="branch" v={project.defaultBranch} mono />
                <Row
                  k="acesso"
                  v={project.ghInstallationId ? "GitHub App · leitura + PR" : "leitura direta"}
                />
                {ingestion && (
                  <>
                    <Row
                      k="última indexação"
                      v={
                        ingestion.finishedAt
                          ? `${formatDateTime(ingestion.finishedAt)}${ingestionDuration !== null ? ` · ${ingestionDuration}s` : ""}`
                          : "em andamento…"
                      }
                      mono
                    />
                    {ingestion.toSha && (
                      <Row k="commit" v={ingestion.toSha.slice(0, 10)} mono />
                    )}
                    <Row
                      k="estado"
                      v={
                        ingestion.status === "success"
                          ? `ok · ${ingestion.stats?.filesIndexed ?? 0} arq. · ${ingestion.stats?.chunksEmbedded ?? 0} chunks`
                          : ingestion.status === "failed"
                            ? "falhou — ver logs do worker"
                            : "rodando"
                      }
                      mono
                    />
                    {(ingestion.stats?.discarded.length ?? 0) > 0 && (
                      <Row
                        k="descartados"
                        v={`${ingestion.stats?.discarded.length} arq. pelo scrub de segredos`}
                        mono
                      />
                    )}
                  </>
                )}
              </dl>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">
                Nenhum repositório configurado — sem ele não há índice nem
                sugestão de responsável.
              </p>
            )}
          </section>

          <section className="border-b border-border p-5">
            <p className="kicker mb-2">pastas sem dono declarado</p>
            {unowned.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                Todas as pastas com atividade têm área declarada.
              </p>
            ) : (
              <ul className="space-y-1 font-mono text-[11.5px]">
                {unowned.map((f) => (
                  <li key={f} className="truncate" title={f}>
                    {f}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              Declarar dono melhora a sugestão da IA nessas áreas.
            </p>
          </section>

          <section className="p-5">
            <div className="flex items-baseline justify-between">
              <p className="kicker">notas de contexto</p>
              <span className="font-mono text-[10px] text-muted-foreground">
                lidas pela IA
              </span>
            </div>
            <NotesEditor projectId={project.id} notes={notes} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  detail,
  detailMono = false,
}: {
  label: string;
  value: string;
  detail: string;
  detailMono?: boolean;
}) {
  return (
    <div className="px-6 py-4">
      <p className="kicker">{label}</p>
      <p className="mt-1 font-mono text-[22px] font-medium tnum">{value}</p>
      <p
        className={
          detailMono
            ? "font-mono text-[10.5px] text-muted-foreground tnum"
            : "text-[11.5px] text-muted-foreground"
        }
      >
        {detail}
      </p>
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={mono ? "truncate font-mono text-[11px]" : ""} title={v}>
        {v}
      </dd>
    </div>
  );
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
