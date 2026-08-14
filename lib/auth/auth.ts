import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { getEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/mailer";

export const auth = betterAuth({
  secret: getEnv().BETTER_AUTH_SECRET,
  baseURL: getEnv().BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Quem chega por convite já provou a posse do e-mail clicando no link —
      // o e-mail de verificação seria ruído redundante.
      const { hasPendingInvite } = await import("@/services/invites");
      if (await hasPendingInvite(user.email)) return;
      await sendEmail({
        to: user.email,
        subject: "Confirme seu e-mail — Patch",
        text: `Olá, ${user.name}.\n\nConfirme seu e-mail para ativar sua conta:\n${url}\n\nSe você não criou esta conta, ignore esta mensagem.`,
      });
    },
  },
  user: {
    modelName: "user",
    additionalFields: {
      /* O papel global nunca vem do cliente: cadastro público é sempre guest;
         admin/staff só via seed ou tela de equipe. */
      role: {
        type: "string",
        defaultValue: "guest",
        input: false,
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
