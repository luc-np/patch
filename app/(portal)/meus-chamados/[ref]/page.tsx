import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { getTicketByNumber } from "@/services/tickets";
import { listMessages } from "@/services/messages";
import { STATUS_LABEL_PUBLIC, formatDateTime } from "@/lib/format";
import { GuestReplyForm } from "./guest-reply-form";

export default async function MyTicketPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const { ref } = await params;
  const number = Number.parseInt(ref, 10);
  if (Number.isNaN(number)) notFound();

  // A policy dentro do service faz o isolamento: chamado de outra pessoa é 404.
  const ticketResult = await getTicketByNumber(actor, number);
  if (!ticketResult.ok) notFound();
  const ticket = ticketResult.value;

  const messagesResult = await listMessages(actor, ticket.id);
  const messages = messagesResult.ok ? messagesResult.value : [];

  return (
    <main className="mx-auto max-w-[560px] px-6 py-8 md:py-12">
      <Link
        href="/meus-chamados"
        className="text-[13px] text-muted-foreground hover:text-foreground"
      >
        ← meus chamados
      </Link>
      <h1 className="mt-4 text-[22px] leading-snug">{ticket.title}</h1>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {STATUS_LABEL_PUBLIC[ticket.status]} · aberto em{" "}
        {formatDateTime(new Date(ticket.createdAt))}
      </p>

      <section className="mt-8 space-y-6">
        <article>
          <p className="text-[13px] font-semibold">Você</p>
          <p className="mt-1 whitespace-pre-wrap">{ticket.body}</p>
        </article>
        {messages.map((m) => (
          <article key={m.id}>
            <p className="text-[13px] font-semibold">
              {m.authorId === actor.id ? "Você" : `${m.authorName} · time`}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">
              {formatDateTime(new Date(m.createdAt))}
            </p>
          </article>
        ))}
      </section>

      {ticket.status !== "closed" && ticket.status !== "resolved" && (
        <GuestReplyForm ticketId={ticket.id} ticketNumber={ticket.number} />
      )}
    </main>
  );
}
