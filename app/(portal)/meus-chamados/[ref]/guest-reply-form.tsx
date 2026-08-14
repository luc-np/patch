"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guestReply } from "./actions";

export function GuestReplyForm({
  ticketId,
  ticketNumber,
}: {
  ticketId: string;
  ticketNumber: number;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-10 border-t-2 border-rule pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setError(null);
        startTransition(async () => {
          const res = await guestReply({ ticketId, ticketNumber, body: body.trim() });
          if (!res.ok) {
            setError(res.error ?? "Não deu para enviar agora.");
            return;
          }
          setBody("");
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-semibold">Responder</span>
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="resize-y border border-input bg-background px-3 py-2.5"
          placeholder="Alguma informação nova ajuda o time a resolver mais rápido."
        />
      </label>
      {error && <p className="mt-2 text-[14px] text-ai-strong">{error}</p>}
      <button
        type="submit"
        disabled={pending || !body.trim()}
        className="mt-3 flex h-[44px] items-center bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar resposta"}
      </button>
    </form>
  );
}
