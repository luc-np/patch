"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestReindex, saveNote } from "./actions";

export function ReindexButton({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [queued, setQueued] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled || pending || queued}
      onClick={() =>
        startTransition(async () => {
          const res = await requestReindex({ projectId });
          if (res.ok) {
            setQueued(true);
            setTimeout(() => {
              setQueued(false);
              router.refresh();
            }, 8000);
          }
        })
      }
      className="flex h-8 items-center border border-input px-3 text-[13px] font-medium hover:bg-accent disabled:opacity-50"
    >
      {queued ? "Reindexação na fila…" : "Reindexar repositório"}
    </button>
  );
}

type Note = { id: string; title: string; body: string };

export function NotesEditor({
  projectId,
  notes,
}: {
  projectId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      await saveNote({
        projectId,
        noteId: editing?.id,
        title: String(data.get("title")),
        body: String(data.get("body")),
      });
      setEditing(null);
      setCreating(false);
      router.refresh();
    });
  }

  if (editing || creating) {
    return (
      <form onSubmit={submit} className="mt-2 flex flex-col gap-2">
        <input
          name="title"
          required
          defaultValue={editing?.title ?? ""}
          placeholder="Título da nota"
          className="h-7 border border-input bg-background px-2 text-[12.5px]"
        />
        <textarea
          name="body"
          required
          rows={5}
          defaultValue={editing?.body ?? ""}
          placeholder="Contexto de negócio, decisões, quirks, clientes…"
          className="resize-y border border-input bg-background px-2 py-1.5 text-[12.5px]"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex h-7 items-center bg-primary px-2.5 text-[12px] font-medium text-primary-foreground disabled:opacity-50"
          >
            Salvar nota
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setCreating(false);
            }}
            className="flex h-7 items-center px-2 text-[12px] text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-2">
      {notes.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">
          Nenhuma nota ainda — o que só você sabe sobre este projeto a IA não
          adivinha.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setEditing(n)}
                className="w-full text-left hover:bg-row-hover"
              >
                <p className="text-[13px] font-semibold">{n.title}</p>
                <p className="line-clamp-2 text-[12px] text-muted-foreground">
                  {n.body}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="mt-3 flex h-7 items-center border border-input px-2.5 text-[12px] font-medium hover:bg-accent"
      >
        {notes.length === 0 ? "Escrever a primeira nota" : "Editar notas"}
      </button>
    </div>
  );
}
