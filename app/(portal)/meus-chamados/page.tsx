import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { listOwnTickets } from "@/services/tickets";
import { STATUS_LABEL_PUBLIC } from "@/lib/format";

export default async function MyTicketsPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const tickets = await listOwnTickets(actor);

  return (
    <main className="mx-auto max-w-[560px] px-6 py-8 md:py-12">
      <header className="flex items-center gap-3">
        <span className="inline-block size-3 bg-ai" aria-hidden />
        <span className="text-[15px] font-extrabold tracking-tight">
          Meus chamados
        </span>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {actor.email}
        </span>
      </header>

      {tickets.length === 0 ? (
        <p className="mt-10 text-muted-foreground">
          Você ainda não abriu nenhum chamado.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-t border-b border-border">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/meus-chamados/${t.number}`}
                className="flex items-baseline gap-3 py-3.5 hover:bg-row-hover"
              >
                <span className="min-w-0 flex-1 truncate text-[15px]">
                  {t.title}
                </span>
                <span className="shrink-0 text-[13px] text-muted-foreground">
                  {STATUS_LABEL_PUBLIC[t.status]}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
