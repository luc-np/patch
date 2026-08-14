"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProjectAction } from "./actions";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="max-w-[560px] px-6 py-8">
        <Link href="/" className="text-[13px] text-muted-foreground hover:text-foreground">
          ← fila
        </Link>
        <h1 className="mt-3 text-[22px]">Novo projeto</h1>
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setError(null);
            startTransition(async () => {
              const res = await createProjectAction({
                name,
                slug,
                description: String(data.get("description")) || undefined,
                repoUrl: String(data.get("repoUrl")) || undefined,
                defaultBranch: String(data.get("defaultBranch")) || "main",
                portalEnabled: data.get("portalEnabled") === "on",
              });
              if (!res.ok || !res.slug) {
                setError(res.error ?? "Não deu para criar agora.");
                return;
              }
              router.push(`/projects/${res.slug}`);
            });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Nome</span>
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              className="h-8 border border-input bg-background px-3 text-[13.5px]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Slug</span>
            <input
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              className="h-8 border border-input bg-background px-3 font-mono text-[12px]"
            />
            <span className="text-[12px] text-muted-foreground">
              Vira a URL do portal: /support/{slug || "…"}
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Descrição</span>
            <textarea
              name="description"
              rows={2}
              className="resize-y border border-input bg-background px-3 py-2 text-[13.5px]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Repositório GitHub</span>
            <input
              name="repoUrl"
              placeholder="https://github.com/org/repo"
              className="h-8 border border-input bg-background px-3 font-mono text-[11.5px]"
            />
            <span className="text-[12px] text-muted-foreground">
              É o que alimenta o índice e a sugestão de responsável. Pode
              configurar depois.
            </span>
          </label>
          <label className="flex w-40 flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Branch padrão</span>
            <input
              name="defaultBranch"
              defaultValue="main"
              className="h-8 border border-input bg-background px-3 font-mono text-[12px]"
            />
          </label>
          <label className="flex items-center gap-2 text-[13.5px]">
            <input type="checkbox" name="portalEnabled" defaultChecked />
            Portal público de chamados ligado
          </label>
          {error && <p className="text-[13px] text-ai-strong">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 flex h-9 w-fit items-center bg-primary px-4 text-[13.5px] font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Criando…" : "Criar projeto"}
          </button>
        </form>
      </div>
    </div>
  );
}
