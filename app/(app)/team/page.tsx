import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { getTeamExpertise, listAreasForActor } from "@/services/expertise";
import { listProjectsForActor } from "@/services/projects";
import { listStaffUsers } from "@/services/members";
import { listPendingInvites } from "@/services/invites";
import { formatShortTime } from "@/lib/format";
import { DeclareAreaFooter } from "./team-client";
import { InviteFooter } from "./invite-client";

const TEAM_GRID = "200px minmax(0,1fr) minmax(0,1fr) 120px";

export default async function TeamPage() {
  const actor = await getActor();
  if (!actor || actor.role === "guest") redirect("/login");

  const teamResult = await getTeamExpertise(actor);
  const team = teamResult.ok ? teamResult.value : [];
  const [areas, projects, staffUsers, pendingInvites] = await Promise.all([
    listAreasForActor(actor),
    listProjectsForActor(actor),
    listStaffUsers(actor),
    listPendingInvites(actor),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <header className="flex items-baseline gap-6 px-6 pt-6 pb-4">
          <h1 className="text-[22px]">Equipe e expertise</h1>
          {/* Legenda: a origem do dado é visível */}
          <span className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <span className="border border-foreground px-1.5 py-px text-[11px] whitespace-nowrap text-foreground">
              área declarada
            </span>
            = alguém afirmou
          </span>
          <span className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <span className="border border-dashed border-muted-foreground px-1.5 py-px text-[11px] whitespace-nowrap">
              área inferida
            </span>
            = o git sugere
          </span>
        </header>

        <div
          className="grid h-7 items-center border-b-2 border-rule px-6 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase"
          style={{ gridTemplateColumns: TEAM_GRID }}
        >
          <span>pessoa</span>
          <span>áreas declaradas</span>
          <span>áreas inferidas do git</span>
          <span className="text-right">último commit</span>
        </div>

        {team.length === 0 && (
          <p className="px-6 py-8 text-[13px] text-muted-foreground">
            Nenhum membro staff nos seus projetos ainda.
          </p>
        )}
        {team.map((member) => (
          <div
            key={member.userId}
            className="grid items-start gap-3 border-b border-border px-6 py-3"
            style={{ gridTemplateColumns: TEAM_GRID }}
          >
            <div>
              <p className="text-[13.5px] font-semibold">{member.name}</p>
              <p className="font-mono text-[10.5px] text-muted-foreground">
                {member.memberRole}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {member.declared.length === 0 ? (
                <span className="text-[12px] text-muted-foreground">—</span>
              ) : (
                member.declared.map((chip) => (
                  <span
                    key={chip.areaId}
                    className="border border-foreground px-1.5 py-px text-[11.5px] whitespace-nowrap"
                    title={chip.projectSlug}
                  >
                    {chip.areaName}
                  </span>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {member.inferred.length === 0 ? (
                <span className="text-[12px] text-muted-foreground">—</span>
              ) : (
                member.inferred.map((chip) => (
                  <span key={chip.areaId} className="flex items-center gap-1">
                    <span
                      className="border border-dashed border-muted-foreground px-1.5 py-px text-[11.5px] whitespace-nowrap text-muted-foreground"
                      title={chip.projectSlug}
                    >
                      {chip.areaName}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground tnum">
                      {chip.weak
                        ? "sinal fraco"
                        : `${chip.commitCount ?? 0} commits`}
                    </span>
                  </span>
                ))
              )}
            </div>

            <span className="text-right font-mono text-[11px] text-muted-foreground tnum">
              {member.lastCommitAt
                ? formatShortTime(new Date(member.lastCommitAt))
                : "—"}
            </span>
          </div>
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

      <footer className="flex shrink-0 flex-wrap items-center gap-4 border-t-2 border-rule px-6 py-2.5">
        {actor.role === "admin" && (
          <>
            <InviteFooter projects={projects} />
            <DeclareAreaFooter
              projects={projects}
              areas={areas}
              people={staffUsers.map((u) => ({ id: u.id, name: u.name }))}
            />
          </>
        )}
        <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">
          área declarada pesa mais que inferida na sugestão — e a inferida nunca
          vira declarada sozinha
        </span>
      </footer>
    </div>
  );
}
