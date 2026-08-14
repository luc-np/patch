"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setError(
        res.error.status === 403
          ? "Confirme seu e-mail antes de entrar — o link foi enviado para sua caixa."
          : "E-mail ou senha não conferem.",
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6">
      <div className="rule-b h-0 w-14 border-t-2 border-rule" aria-hidden />
      <h1 className="mt-4 text-[26px]">Entrar no Patch</h1>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 border border-input bg-background px-3 text-[13.5px]"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-[13px] text-ai-strong">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 flex h-10 items-center justify-start bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="mt-6 text-[13px] text-muted-foreground">
        Ainda sem conta?{" "}
        <Link href="/signup" className="underline underline-offset-2">
          Criar conta
        </Link>
      </p>
    </main>
  );
}
