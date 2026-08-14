"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth/client";
import { acceptWithNewAccount, acceptAsLoggedUser } from "./actions";

export function AcceptInviteForm({
  token,
  email,
  hasAccount,
  loggedInMatches,
  loggedInAsOther,
}: {
  token: string;
  email: string;
  hasAccount: boolean;
  loggedInMatches: boolean;
  loggedInAsOther: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Logado com o e-mail do convite: um clique resolve.
  if (loggedInMatches) {
    return (
      <div className="mt-8">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await acceptAsLoggedUser({ token });
              if (!res.ok) {
                setError(res.error ?? "Não deu para aceitar agora.");
                return;
              }
              router.push("/");
              router.refresh();
            })
          }
          className="flex h-[46px] items-center bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Entrando no time…" : "Aceitar convite"}
        </button>
        {error && <p className="mt-3 text-[14px] text-ai-strong">{error}</p>}
      </div>
    );
  }

  if (loggedInAsOther) {
    return (
      <p className="mt-8 text-[14px] text-muted-foreground">
        Você está logado com outro e-mail. Saia da conta atual e abra este link
        de novo para aceitar como{" "}
        <span className="font-mono text-[13px]">{email}</span>.
      </p>
    );
  }

  // Conta já existe mas sem sessão: entrar primeiro.
  if (hasAccount) {
    return (
      <div className="mt-8">
        <p className="text-[14px] text-muted-foreground">
          Já existe uma conta com este e-mail. Entre e abra este link de novo
          para aceitar o convite.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex h-[46px] items-center bg-primary px-4 text-[15px] font-semibold text-primary-foreground"
        >
          Entrar
        </Link>
      </div>
    );
  }

  // Pessoa nova: cria a conta já verificada e entra direto.
  return (
    <form
      className="mt-8 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const password = String(data.get("password"));
        setError(null);
        startTransition(async () => {
          const res = await acceptWithNewAccount({
            token,
            name: String(data.get("name")),
            password,
          });
          if (!res.ok) {
            setError(res.error ?? "Não deu para criar sua conta agora.");
            return;
          }
          const login = await signIn.email({ email, password });
          if (login.error) {
            router.push("/login");
            return;
          }
          router.push("/");
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-semibold">Seu nome</span>
        <input
          name="name"
          required
          maxLength={120}
          className="h-[46px] border border-input bg-background px-3"
          autoComplete="name"
        />
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
          Pelo menos 8 caracteres.
        </span>
      </label>
      {error && <p className="text-[14px] text-ai-strong">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-[46px] items-center bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Criando conta…" : "Aceitar e criar minha conta"}
      </button>
    </form>
  );
}
