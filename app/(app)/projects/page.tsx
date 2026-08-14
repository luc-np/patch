import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { listProjectsForActor } from "@/services/projects";

/** Área de Projetos: ver todos, abrir, editar e criar. */
export default async function ProjectsPage() {
  const actor = await getActor();
  if (!actor || actor.role === "guest") redirect("/login");

  const projects = await listProjectsForActor(actor);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <h1 className="text-[22px]">Projetos</h1>
        <span className="font-mono text-[11px] text-muted-foreground tnum">
          {projects.length}
        </span>
        {actor.role === "admin" && (
          <Link
            href="/projects/new"
            className="ml-auto flex h-8 items-center bg-primary px-3 text-[12.5px] font-medium text-primary-foreground"
          >
            Novo projeto
          </Link>
        )}
      </div>

      <div
        className="grid h-7 items-center border-b-2 border-rule px-6 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase"
        style={{ gridTemplateColumns: "minmax(160px,1fr) 120px 90px 110px minmax(0,1.4fr) 90px" }}
      >
        <span>projeto</span>
        <span>slug</span>
        <span>abertos</span>
        <span>portal</span>
        <span>repositório</span>
        <span className="text-right">ações</span>
      </div>

      {projects.length === 0 && (
        <p className="px-6 py-8 text-[13px] text-muted-foreground">
          Nenhum projeto ainda.{" "}
          {actor.role === "admin"
            ? "Crie o primeiro em “Novo projeto”."
            : "Peça a um admin para incluir você em um."}
        </p>
      )}

      {projects.map((p) => (
        <div
          key={p.id}
          className="grid h-11 items-center border-b border-border px-6 text-[13px] hover:bg-row-hover"
          style={{ gridTemplateColumns: "minmax(160px,1fr) 120px 90px 110px minmax(0,1.4fr) 90px" }}
        >
          <Link
            href={`/projects/${p.slug}`}
            className="truncate font-semibold hover:underline hover:underline-offset-3"
            title={p.description ?? p.name}
          >
            {p.name}
          </Link>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {p.slug}
          </span>
          <span className="font-mono text-[11px] tnum">{p.openCount}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {p.portalEnabled ? "ligado" : "desligado"}
          </span>
          <span
            className="truncate font-mono text-[11px] text-muted-foreground"
            title={p.repoUrl ?? undefined}
          >
            {p.repoUrl ? p.repoUrl.replace(/^https:\/\/(www\.)?/, "") : "—"}
          </span>
          <span className="flex justify-end gap-3 text-[12px]">
            <Link
              href={`/projects/${p.slug}`}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              Ver
            </Link>
            {actor.role === "admin" && (
              <Link
                href={`/projects/${p.slug}/edit`}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                Editar
              </Link>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
