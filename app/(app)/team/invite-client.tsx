"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteAction } from "./actions";

type Project = { id: string; slug: string };

const ROLES = ["dev", "cs", "qa", "designer", "po"] as const;

/** Convite de equipe: e-mail + projeto + função → a pessoa recebe o link. */
export function InviteFooter({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSent(null);
          }}
          className="flex h-8 items-center bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground"
        >
          Convidar pessoa
        </button>
        {sent && (
          <span className="font-mono text-[11px] text-muted-foreground">
            convite enviado para {sent}
          </span>
        )}
      </div>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const email = String(data.get("email"));
        setError(null);
        startTransition(async () => {
          const res = await inviteAction({
            email,
            projectId: String(data.get("projectId")),
            role: String(data.get("role")) as (typeof ROLES)[number],
          });
          if (!res.ok) {
            setError(res.error ?? "Não deu para convidar agora.");
            return;
          }
          setSent(email);
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <input
        name="email"
        type="email"
        required
        placeholder="pessoa@empresa.com"
        className="h-8 w-56 border border-input bg-background px-2 text-[12.5px]"
      />
      <span className="text-[12.5px] text-muted-foreground">entra em</span>
      <select
        name="projectId"
        className="h-8 border border-input bg-background px-2 font-mono text-[11.5px]"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.slug}
          </option>
        ))}
      </select>
      <span className="text-[12.5px] text-muted-foreground">como</span>
      <select
        name="role"
        className="h-8 border border-input bg-background px-2 font-mono text-[11.5px]"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending || projects.length === 0}
        className="flex h-8 items-center bg-primary px-3 text-[12.5px] font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Enviando…" : "Enviar convite"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[12px] text-muted-foreground hover:text-foreground"
      >
        Cancelar
      </button>
      {error && <span className="text-[12px] text-ai-strong">{error}</span>}
    </form>
  );
}
