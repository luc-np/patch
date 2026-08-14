"use client";

import { useState, useTransition } from "react";
import { openTicket } from "./actions";

const AREAS = [
  "Não sei dizer",
  "Pagamento",
  "Cadastro e conta",
  "Erro na tela",
  "Lentidão",
  "Outra coisa",
];

export function PortalForm({
  slug,
  loggedIn,
  email,
}: {
  slug: string;
  loggedIn: boolean;
  email: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ createdAccount: boolean } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await openTicket({
        slug,
        body: String(data.get("body")),
        area: String(data.get("area")),
        signup: loggedIn
          ? undefined
          : {
              name: String(data.get("name")),
              email: String(data.get("email")),
              password: String(data.get("password")),
            },
      });
      if (!res.ok) {
        setError(res.error ?? "Não deu para abrir o chamado agora. Tente de novo em instantes.");
        return;
      }
      setDone({ createdAccount: res.createdAccount ?? false });
    });
  }

  if (done) {
    return (
      <div className="mt-8">
        <div className="h-0 w-14 border-t-2 border-rule" aria-hidden />
        <h2 className="mt-4 text-[22px]">Chamado aberto.</h2>
        <p className="mt-3 max-w-[48ch] text-muted-foreground">
          O time já recebeu. A resposta chega no seu e-mail
          {done.createdAccount
            ? " — e enviamos também um link para confirmar sua conta, para você acompanhar tudo em “meus chamados”."
            : ", e você acompanha em “meus chamados”."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-semibold">O que deu errado?</span>
        <textarea
          name="body"
          required
          rows={4}
          maxLength={10_000}
          className="resize-y border border-input bg-background px-3 py-2.5"
          placeholder="Descreva o que você tentou fazer e o que aconteceu."
        />
        <span className="text-[12.5px] text-muted-foreground">
          Quanto mais detalhe, mais rápida a resposta — vale colar a mensagem de
          erro inteira.
        </span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-semibold">Onde você estava?</span>
        <select
          name="area"
          className="h-[46px] border border-input bg-background px-3"
        >
          {AREAS.map((a) => (
            <option key={a} value={a === "Não sei dizer" ? "" : a}>
              {a}
            </option>
          ))}
        </select>
      </label>

      {loggedIn ? (
        <p className="text-[13px] text-muted-foreground">
          Conectado como <span className="font-mono text-[12px]">{email}</span>.
          É por aqui que a resposta chega.
        </p>
      ) : (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold">Seu nome</span>
            <input
              name="name"
              required
              className="h-[46px] border border-input bg-background px-3"
              autoComplete="name"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold">Seu e-mail</span>
            <input
              name="email"
              type="email"
              required
              className="h-[46px] border border-input bg-background px-3"
              autoComplete="email"
            />
            <span className="text-[12.5px] text-muted-foreground">
              É por aqui que a resposta chega.
            </span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold">Crie uma senha</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="h-[46px] border border-input bg-background px-3"
              autoComplete="new-password"
            />
            <span className="text-[12.5px] text-muted-foreground">
              Para você acompanhar o chamado depois. Pelo menos 8 caracteres.
            </span>
          </label>
        </>
      )}

      {error && <p className="text-[14px] text-ai-strong">{error}</p>}

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex h-[48px] items-center justify-start px-4 text-[15px] font-semibold disabled:opacity-60"
          style={{
            background: "var(--project-accent)",
            color: "var(--ai-foreground)",
          }}
        >
          {pending ? "Abrindo…" : "Abrir chamado"}
        </button>
        <p className="text-[13px] text-muted-foreground">
          Você recebe um número de acompanhamento na hora.
        </p>
      </div>
    </form>
  );
}
