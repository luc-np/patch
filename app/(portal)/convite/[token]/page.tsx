import { getInviteByToken } from "@/services/invites";
import { getActor } from "@/lib/auth/session";
import { AcceptInviteForm } from "./accept-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const inviteResult = await getInviteByToken(token);

  if (!inviteResult.ok) {
    return (
      <main className="mx-auto max-w-[480px] px-6 py-16">
        <div className="h-0 w-14 border-t-2 border-rule" aria-hidden />
        <h1 className="mt-4 text-[25px]">
          {inviteResult.error === "expired"
            ? "Este convite expirou."
            : "Convite não encontrado."}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {inviteResult.error === "expired"
            ? "Convites valem por 7 dias. Peça um novo para quem convidou você."
            : "O link pode ter sido usado ou digitado errado. Peça um novo convite."}
        </p>
      </main>
    );
  }

  const invite = inviteResult.value;
  const actor = await getActor();
  const loggedInMatches =
    actor?.email.toLowerCase() === invite.email.toLowerCase();

  return (
    <main className="mx-auto max-w-[480px] px-6 py-12 md:py-16">
      <div className="h-0 w-14 border-t-2 border-rule" aria-hidden />
      <h1 className="mt-4 text-[25px] leading-tight">
        {invite.invitedByName} convidou você para o {invite.projectName}.
      </h1>
      <p className="mt-3 text-muted-foreground">
        Você entra no time como{" "}
        <span className="font-mono text-[13px]">{invite.role}</span>, com o
        e-mail <span className="font-mono text-[13px]">{invite.email}</span>.
      </p>

      <AcceptInviteForm
        token={token}
        email={invite.email}
        hasAccount={invite.hasAccount}
        loggedInMatches={loggedInMatches}
        loggedInAsOther={Boolean(actor) && !loggedInMatches}
      />
    </main>
  );
}
