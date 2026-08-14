import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { getTicketByNumber } from "@/services/tickets";
import { listMessages } from "@/services/messages";
import { listProjectMembers, listTicketActivity } from "@/services/members";
import { TicketScreen } from "@/components/patch/ticket/ticket-screen";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const { ref } = await params;
  const number = Number.parseInt(ref.replace(/^PT-/i, ""), 10);
  if (Number.isNaN(number)) notFound();

  const ticketResult = await getTicketByNumber(actor, number);
  if (!ticketResult.ok) notFound();
  const ticket = ticketResult.value;

  const [messagesResult, membersResult, activity] = await Promise.all([
    listMessages(actor, ticket.id),
    listProjectMembers(actor, ticket.projectId),
    listTicketActivity(ticket.id),
  ]);

  return (
    <TicketScreen
      ticket={ticket}
      messages={messagesResult.ok ? messagesResult.value : []}
      members={membersResult.ok ? membersResult.value : []}
      activity={activity}
    />
  );
}
