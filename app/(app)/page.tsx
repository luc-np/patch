import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { listQueue, getQueueCounts, type QueueView } from "@/services/tickets";
import { listProjectsForActor, getLatestIngestion } from "@/services/projects";
import { QueueScreen, type IndexStatus } from "@/components/patch/queue/queue-screen";
import { formatDateTime } from "@/lib/format";

const VALID_VIEWS: QueueView[] = ["mine", "unassigned", "suggested", "due_today", "all"];

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor || actor.role === "guest") redirect("/login");

  const params = await searchParams;
  const viewParam = typeof params.view === "string" ? params.view : "mine";
  const view: QueueView = VALID_VIEWS.includes(viewParam as QueueView)
    ? (viewParam as QueueView)
    : "mine";
  const projectSlug = typeof params.project === "string" ? params.project : undefined;
  const origins =
    typeof params.origins === "string"
      ? (params.origins
          .split(",")
          .filter((o) => ["portal", "whatsapp", "internal"].includes(o)) as (
          | "portal"
          | "whatsapp"
          | "internal"
        )[])
      : undefined;
  const search = typeof params.q === "string" ? params.q : undefined;

  const [queueResult, countsResult, projects] = await Promise.all([
    listQueue(actor, { view, projectSlug, origins, search }),
    getQueueCounts(actor),
    listProjectsForActor(actor),
  ]);

  if (!queueResult.ok || !countsResult.ok) redirect("/login");

  // Rodapé do rail: estado do índice do primeiro projeto com ingestão
  let indexStatus: IndexStatus = null;
  for (const p of projects) {
    const run = await getLatestIngestion(p.id);
    if (run?.finishedAt && run.stats) {
      indexStatus = {
        projectSlug: p.slug,
        finishedAt: formatDateTime(run.finishedAt),
        fileCount: run.stats.filesIndexed,
      };
      break;
    }
  }

  return (
    <QueueScreen
      items={queueResult.value}
      counts={countsResult.value}
      projects={projects}
      view={view}
      activeProjectSlug={projectSlug ?? null}
      indexStatus={indexStatus}
      resolvedTodayNote={null}
    />
  );
}
