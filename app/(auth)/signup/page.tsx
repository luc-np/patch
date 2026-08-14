"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth/client";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signUp.email({ name, email, password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "Não deu para criar a conta agora.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6">
        <div className="h-0 w-14 border-t-2 border-rule" aria-hidden />
        <h1 className="mt-4 text-[26px]">Confirme seu e-mail.</h1>
        <p className="mt-4 text-[14px] text-muted-foreground">
          Enviamos um link de confirmação para{" "}
          <span className="font-mono text-[12px]">{email}</span>. Depois de
          confirmar, é só entrar.
        </p>
        <p className="mt-6 text-[13px]">
          <Link href="/login" className="underline underline-offset-2">
            Ir para o login
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6">
      <div className="h-0 w-14 border-t-2 border-rule" aria-hidden />
      <h1 className="mt-4 text-[26px]">Criar conta</h1>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">Nome</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 border border-input bg-background px-3 text-[13.5px]"
            autoComplete="name"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 border border-input bg-background px-3 text-[13.5px]"
            autoComplete="email"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">Senha</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 border border-input bg-background px-3 text-[13.5px]"
            autoComplete="new-password"
          />
          <span className="text-[12.5px] text-muted-foreground">
            Pelo menos 8 caracteres.
          </span>
        </label>
        {error && <p className="text-[13px] text-ai-strong">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 flex h-10 items-center justify-start bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Criando…" : "Criar conta"}
        </button>
      </form>
      <p className="mt-6 text-[13px] text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </main>
  );
}
