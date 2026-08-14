import { notFound } from "next/navigation";
import Link from "next/link";
import { getPortalProject } from "@/services/portal";
import { getActor } from "@/lib/auth/session";
import { listOwnTickets } from "@/services/tickets";
import { STATUS_LABEL_PUBLIC } from "@/lib/format";
import { PortalForm } from "./portal-form";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const projectResult = await getPortalProject(slug);
  if (!projectResult.ok) notFound();
  const project = projectResult.value;

  const actor = await getActor();
  const ownTickets = actor
    ? (await listOwnTickets(actor)).filter((t) => t.projectSlug === slug)
    : [];

  const accent = project.accentColor ?? undefined;

  return (
    <main
      className="mx-auto max-w-[560px] px-6 py-8 md:py-12"
      style={accent ? ({ "--project-accent": accent } as React.CSSProperties) : undefined}
    >
      <header className="flex items-center gap-3">
        <span
          className="inline-block size-3 shrink-0"
          style={{ background: "var(--project-accent)" }}
          aria-hidden
        />
        <span className="text-[15px] font-extrabold tracking-tight">
          {project.name}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">suporte</span>
        <Link
          href="/meus-chamados"
          className="ml-auto text-[13px] underline underline-offset-2"
        >
          meus chamados
        </Link>
      </header>

      <h1 className="mt-8 text-[25px] leading-tight md:mt-10 md:text-[32px]">
        Conte o que aconteceu.
      </h1>
      <p className="mt-3 max-w-[48ch] text-muted-foreground">
        Quem lê é o time que cuida do {project.name} — a primeira resposta
        costuma sair em poucas horas úteis.
      </p>

      <PortalForm slug={slug} loggedIn={actor !== null} email={actor?.email ?? null} />

      {ownTickets.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[18px]">Seus chamados</h2>
          <ul className="mt-4 divide-y divide-border border-t border-b border-border">
            {ownTickets.map((t) => (
              <li key={t.id} className="flex items-baseline gap-3 py-3">
                <span className="min-w-0 flex-1 truncate text-[15px]">{t.title}</span>
                <span className="shrink-0 text-[13px] text-muted-foreground">
                  {STATUS_LABEL_PUBLIC[t.status]}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-16 border-t border-border pt-4 text-[13px] text-muted-foreground">
        Atendimento em dias úteis, das 9h às 18h.
      </footer>
    </main>
  );
}
