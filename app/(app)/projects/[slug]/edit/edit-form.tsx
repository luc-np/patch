"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateProjectAction } from "./actions";

type ProjectData = {
  id: string;
  name: string;
  slug: string;
  description: string;
  repoUrl: string;
  defaultBranch: string;
  portalEnabled: boolean;
  accentColor: string;
};

export function EditProjectForm({ project }: { project: ProjectData }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="max-w-[560px] px-6 py-8">
        <Link
          href={`/projects/${project.slug}`}
          className="text-[13px] text-muted-foreground hover:text-foreground"
        >
          ← {project.name}
        </Link>
        <h1 className="mt-3 text-[22px]">Editar projeto</h1>
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setError(null);
            startTransition(async () => {
              const res = await updateProjectAction({
                projectId: project.id,
                name: String(data.get("name")),
                description: String(data.get("description")) || undefined,
                repoUrl: String(data.get("repoUrl")) || undefined,
                defaultBranch: String(data.get("defaultBranch")) || "main",
                portalEnabled: data.get("portalEnabled") === "on",
                accentColor: String(data.get("accentColor")) || undefined,
              });
              if (!res.ok) {
                setError(res.error ?? "Não deu para salvar agora.");
                return;
              }
              router.push(`/projects/${project.slug}`);
              router.refresh();
            });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Nome</span>
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={project.name}
              className="h-8 border border-input bg-background px-3 text-[13.5px]"
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Slug</span>
            <p className="font-mono text-[12px] text-muted-foreground">
              {project.slug} · não muda — é a URL pública do portal
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Descrição</span>
            <textarea
              name="description"
              rows={2}
              defaultValue={project.description}
              className="resize-y border border-input bg-background px-3 py-2 text-[13.5px]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Repositório GitHub</span>
            <input
              name="repoUrl"
              defaultValue={project.repoUrl}
              placeholder="https://github.com/org/repo"
              className="h-8 border border-input bg-background px-3 font-mono text-[11.5px]"
            />
          </label>
          <div className="flex gap-4">
            <label className="flex w-40 flex-col gap-1.5">
              <span className="text-[13.5px] font-semibold">Branch padrão</span>
              <input
                name="defaultBranch"
                defaultValue={project.defaultBranch}
                className="h-8 border border-input bg-background px-3 font-mono text-[12px]"
              />
            </label>
            <label className="flex w-44 flex-col gap-1.5">
              <span className="text-[13.5px] font-semibold">Cor do portal</span>
              <input
                name="accentColor"
                defaultValue={project.accentColor}
                placeholder="#ec3013"
                className="h-8 border border-input bg-background px-3 font-mono text-[12px]"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-[13.5px]">
            <input
              type="checkbox"
              name="portalEnabled"
              defaultChecked={project.portalEnabled}
            />
            Portal público de chamados ligado
          </label>
          {error && <p className="text-[13px] text-ai-strong">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="mt-1 flex h-9 items-center bg-primary px-4 text-[13.5px] font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar projeto"}
            </button>
            <Link
              href={`/projects/${project.slug}`}
              className="mt-1 text-[13px] text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
