import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { listQueue, type QueueView } from "@/services/tickets";
import { QueueScreen } from "@/components/patch/queue/queue-screen";

const VALID_VIEWS: QueueView[] = ["mine", "unassigned", "suggested", "due_today", "all"];

/** Área de Chamados: o que chega de fora (portal, WhatsApp) e bugs — sem tasks. */
export default async function ChamadosPage({
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

  const result = await listQueue(actor, {
    view,
    origins,
    search,
    types: ["support", "bug"],
  });

  return (
    <QueueScreen
      items={result.ok ? result.value : []}
      counts={{ mine: 0, unassigned: 0, suggested: 0, dueToday: 0 }}
      projects={[]}
      view={view}
      activeProjectSlug={null}
      indexStatus={null}
      resolvedTodayNote={null}
      title="Chamados"
      createHref="/tickets/new?type=support"
      createLabel="Novo chamado"
      showRail={false}
      emptyNote="Nenhum chamado aberto. Os que chegarem pelo portal, WhatsApp ou pelo time aparecem aqui."
    />
  );
}
