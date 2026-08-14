"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProjectSummary } from "@/services/projects";
import { createInternalTicket } from "./actions";

export function NewTicketForm({ projects }: { projects: ProjectSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await createInternalTicket({
        projectId: String(data.get("projectId")),
        type: String(data.get("type")) as "task" | "bug" | "support",
        title: String(data.get("title")),
        body: String(data.get("body")),
        priority: String(data.get("priority")) as
          | "low"
          | "normal"
          | "high"
          | "urgent",
      });
      if (!res.ok || !res.number) {
        setError(res.error ?? "Não deu para abrir agora.");
        return;
      }
      router.push(`/tickets/${res.number}`);
    });
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="max-w-[560px] px-6 py-8">
        <Link href="/" className="text-[13px] text-muted-foreground hover:text-foreground">
          ← fila
        </Link>
        <h1 className="mt-3 text-[22px]">Abrir task ou chamado</h1>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Projeto</span>
            <select
              name="projectId"
              required
              className="h-8 border border-input bg-background px-2 font-mono text-[12px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.slug}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[13.5px] font-semibold">Tipo</span>
              <select
                name="type"
                className="h-8 border border-input bg-background px-2 font-mono text-[12px]"
              >
                <option value="task">task</option>
                <option value="bug">bug</option>
                <option value="support">chamado</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[13.5px] font-semibold">Prioridade</span>
              <select
                name="priority"
                defaultValue="normal"
                className="h-8 border border-input bg-background px-2 font-mono text-[12px]"
              >
                <option value="low">baixa</option>
                <option value="normal">normal</option>
                <option value="high">alta</option>
                <option value="urgent">urgente</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Título</span>
            <input
              name="title"
              required
              maxLength={200}
              className="h-8 border border-input bg-background px-3 text-[13.5px]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Descrição</span>
            <textarea
              name="body"
              rows={5}
              className="resize-y border border-input bg-background px-3 py-2 text-[13.5px]"
            />
          </label>
          {error && <p className="text-[13px] text-ai-strong">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 flex h-9 w-fit items-center bg-primary px-4 text-[13.5px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Abrindo…" : "Abrir task"}
          </button>
        </form>
      </div>
    </div>
  );
}
