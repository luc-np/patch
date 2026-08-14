"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "./actions";

const ROLES = ["dev", "cs", "qa", "designer", "po"] as const;
type Role = (typeof ROLES)[number] | "collaborator";

type Member = {
  userId: string;
  name: string;
  email: string;
  expertise: string | null;
  projects: { projectId: string; slug: string; role: Role }[];
  lastCommitLabel: string;
};

/** Linha da equipe: perfil visível; admin edita texto + vínculos de projeto inline. */
export function MemberRow({
  member,
  allProjects,
  canEdit,
  grid,
}: {
  member: Member;
  allProjects: { id: string; slug: string }[];
  canEdit: boolean;
  grid: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<Map<string, Role>>(
    () => new Map(member.projects.map((p) => [p.projectId, p.role])),
  );
  const [expertise, setExpertise] = useState(member.expertise ?? "");

  function toggleProject(projectId: string) {
    setLinks((prev) => {
      const next = new Map(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.set(projectId, "dev");
      return next;
    });
  }

  function setRole(projectId: string, role: Role) {
    setLinks((prev) => new Map(prev).set(projectId, role));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateProfileAction({
        userId: member.userId,
        expertise,
        memberships: [...links.entries()].map(([projectId, role]) => ({
          projectId,
          role,
        })),
      });
      if (!res.ok) {
        setError(res.error ?? "Não deu para salvar.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="border-b border-border">
      <div
        className="grid items-start gap-3 px-6 py-3"
        style={{ gridTemplateColumns: grid }}
      >
        <div>
          <p className="text-[13.5px] font-semibold">{member.name}</p>
          <p className="truncate font-mono text-[10.5px] text-muted-foreground">
            {member.email}
          </p>
        </div>

        <p className="text-[12.5px] whitespace-pre-wrap">
          {member.expertise || (
            <span className="text-muted-foreground">
              sem perfil ainda — a IA só conta com o histórico do git
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {member.projects.length === 0 ? (
            <span className="text-[12px] text-muted-foreground">—</span>
          ) : (
            member.projects.map((p) => (
              <span
                key={p.projectId}
                className="border border-border px-1.5 py-px font-mono text-[11px] whitespace-nowrap"
              >
                {p.slug} · {p.role}
              </span>
            ))
          )}
        </div>

        <span className="text-right font-mono text-[11px] text-muted-foreground tnum">
          {member.lastCommitLabel}
        </span>

        {canEdit ? (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="text-right text-[12px] text-muted-foreground hover:text-foreground hover:underline"
          >
            {editing ? "Fechar" : "Editar"}
          </button>
        ) : (
          <span />
        )}
      </div>

      {editing && (
        <div className="border-t border-border bg-card px-6 py-4">
          <label className="flex max-w-[70ch] flex-col gap-1.5">
            <span className="text-[13px] font-semibold">
              O que {member.name.split(" ")[0]} faz?
            </span>
            <textarea
              rows={3}
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              placeholder="Ex.: cuida do e-commerce e das integrações de pagamento; geralmente pega o que é novo nos projetos; conhece bem o fluxo fiscal."
              className="resize-y border border-input bg-background px-3 py-2 text-[13px]"
            />
            <span className="text-[11.5px] text-muted-foreground">
              Este texto vira vetor: quando um chamado chega, a IA compara com o
              perfil de cada pessoa para sugerir quem atende.
            </span>
          </label>

          <p className="kicker mt-4 mb-1.5">projetos desta pessoa</p>
          <div className="flex flex-col gap-1.5">
            {allProjects.map((p) => {
              const checked = links.has(p.id);
              return (
                <label key={p.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProject(p.id)}
                  />
                  <span className="w-40 truncate font-mono text-[12px]">{p.slug}</span>
                  {checked && (
                    <select
                      value={links.get(p.id)}
                      onChange={(e) => setRole(p.id, e.target.value as Role)}
                      className="h-6 border border-input bg-background px-1 font-mono text-[11px]"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              );
            })}
          </div>

          {error && <p className="mt-2 text-[12.5px] text-ai-strong">{error}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex h-8 items-center bg-primary px-3 text-[12.5px] font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar perfil"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[12px] text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
