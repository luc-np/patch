import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { getTeam } from "@/services/expertise";
import { listProjectsForActor } from "@/services/projects";
import { listPendingInvites } from "@/services/invites";
import { formatShortTime } from "@/lib/format";
import { MemberRow } from "./member-row";
import { InviteFooter } from "./invite-client";

const TEAM_GRID = "200px minmax(0,1.4fr) minmax(180px,0.8fr) 110px 70px";

export default async function TeamPage() {
  const actor = await getActor();
  if (!actor || actor.role === "guest") redirect("/login");

  const teamResult = await getTeam(actor);
  const team = teamResult.ok ? teamResult.value : [];
  const [projects, pendingInvites] = await Promise.all([
    listProjectsForActor(actor),
    listPendingInvites(actor),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <header className="flex items-baseline gap-4 px-6 pt-6 pb-4">
          <h1 className="text-[22px]">Equipe</h1>
          <span className="font-mono text-[11px] text-muted-foreground tnum">
            {team.length}
          </span>
        </header>

        <div
          className="grid h-7 items-center gap-3 border-b-2 border-rule px-6 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase"
          style={{ gridTemplateColumns: TEAM_GRID }}
        >
          <span>pessoa</span>
          <span>o que faz</span>
          <span>projetos</span>
          <span className="text-right">último commit</span>
          <span />
        </div>

        {team.length === 0 && (
          <p className="px-6 py-8 text-[13px] text-muted-foreground">
            Nenhum membro staff ainda — convide alguém pelo botão abaixo.
          </p>
        )}
        {team.map((member) => (
          <MemberRow
            key={member.userId}
            member={{
              ...member,
              lastCommitLabel: member.lastCommitAt
                ? formatShortTime(new Date(member.lastCommitAt))
                : "—",
            }}
            allProjects={projects.map((p) => ({ id: p.id, slug: p.slug }))}
            canEdit={actor.role === "admin"}
            grid={TEAM_GRID}
          />
        ))}
      </div>

      {pendingInvites.length > 0 && (
        <div className="border-t border-border px-6 py-2">
          <p className="kicker mb-1">convites pendentes</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
            {pendingInvites.map((inv) => (
              <li key={inv.id}>
                {inv.email} · {inv.projectSlug} · {inv.role} · expira{" "}
                {new Date(inv.expiresAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="shrink-0 border-t-2 border-rule px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-4">
          {actor.role === "admin" && <InviteFooter projects={projects} />}
          <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">
            o perfil de cada pessoa vira vetor e alimenta a sugestão de
            responsável — quanto mais específico, melhor a triagem
          </span>
        </div>
      </footer>
    </div>
  );
}
