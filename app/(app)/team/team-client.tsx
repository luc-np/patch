"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAreaAction, declareExpertiseAction } from "./actions";

type Project = { id: string; slug: string };
type Area = { id: string; name: string; projectSlug: string };
type Person = { id: string; name: string };

/** Rodapé da equipe: criar área nomeada e declarar expertise (admin). */
export function DeclareAreaFooter({
  projects,
  areas,
  people,
}: {
  projects: Project[];
  areas: Area[];
  people: Person[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "area" | "declare">("idle");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (mode === "idle") {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("declare")}
          className="flex h-8 items-center bg-primary px-3 text-[12.5px] font-medium text-primary-foreground"
        >
          Declarar uma área
        </button>
        <button
          type="button"
          onClick={() => setMode("area")}
          className="flex h-8 items-center border border-input px-3 text-[12.5px] font-medium hover:bg-accent"
        >
          Criar área nova
        </button>
      </div>
    );
  }

  if (mode === "area") {
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const res = await createAreaAction({
              projectId: String(data.get("projectId")),
              name: String(data.get("name")),
              globs: String(data.get("globs"))
                .split(",")
                .map((g) => g.trim())
                .filter(Boolean),
            });
            if (!res.ok) {
              setError(res.error ?? "Não deu para criar.");
              return;
            }
            setMode("idle");
            router.refresh();
          });
        }}
      >
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
        <input
          name="name"
          required
          placeholder="nome da área (ex.: checkout)"
          className="h-8 w-48 border border-input bg-background px-2 text-[12.5px]"
        />
        <input
          name="globs"
          placeholder="globs: src/checkout/**, docs/checkout*.md"
          className="h-8 w-72 border border-input bg-background px-2 font-mono text-[11px]"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex h-8 items-center bg-primary px-3 text-[12.5px] font-medium text-primary-foreground disabled:opacity-50"
        >
          Criar área
        </button>
        <button
          type="button"
          onClick={() => setMode("idle")}
          className="text-[12px] text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
        {error && <span className="text-[12px] text-ai-strong">{error}</span>}
      </form>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const res = await declareExpertiseAction({
            areaId: String(data.get("areaId")),
            userId: String(data.get("userId")),
          });
          if (!res.ok) {
            setError(res.error ?? "Não deu para declarar.");
            return;
          }
          setMode("idle");
          router.refresh();
        });
      }}
    >
      <select
        name="userId"
        className="h-8 border border-input bg-background px-2 text-[12.5px]"
      >
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span className="text-[12.5px] text-muted-foreground">domina</span>
      <select
        name="areaId"
        className="h-8 border border-input bg-background px-2 text-[12.5px]"
      >
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {a.projectSlug}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending || areas.length === 0}
        className="flex h-8 items-center bg-primary px-3 text-[12.5px] font-medium text-primary-foreground disabled:opacity-50"
      >
        Declarar
      </button>
      <button
        type="button"
        onClick={() => setMode("idle")}
        className="text-[12px] text-muted-foreground hover:text-foreground"
      >
        Cancelar
      </button>
      {areas.length === 0 && (
        <span className="text-[12px] text-muted-foreground">
          crie uma área primeiro
        </span>
      )}
      {error && <span className="text-[12px] text-ai-strong">{error}</span>}
    </form>
  );
}
