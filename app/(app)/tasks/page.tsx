import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { listQueue, type QueueView } from "@/services/tickets";
import { QueueScreen } from "@/components/patch/queue/queue-screen";

const VALID_VIEWS: QueueView[] = ["mine", "unassigned", "suggested", "due_today", "all"];

/** Área de Tasks: o trabalho interno do time — separado dos chamados. */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor || actor.role === "guest") redirect("/login");

  const params = await searchParams;
  const viewParam = typeof params.view === "string" ? params.view : "all";
  const view: QueueView = VALID_VIEWS.includes(viewParam as QueueView)
    ? (viewParam as QueueView)
    : "all";
  const search = typeof params.q === "string" ? params.q : undefined;

  const result = await listQueue(actor, { view, search, types: ["task"] });

  return (
    <QueueScreen
      items={result.ok ? result.value : []}
      counts={{ mine: 0, unassigned: 0, suggested: 0, dueToday: 0 }}
      projects={[]}
      view={view}
      activeProjectSlug={null}
      indexStatus={null}
      resolvedTodayNote={null}
      title="Tasks"
      createHref="/tickets/new?type=task"
      createLabel="Nova task"
      showRail={false}
      showOrigins={false}
      emptyNote="Nenhuma task aberta. Crie uma nova ou gere uma a partir de um chamado."
    />
  );
}
