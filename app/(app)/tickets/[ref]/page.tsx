import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { getTicketByNumber } from "@/services/tickets";
import { listMessages } from "@/services/messages";
import { listProjectMembers, listTicketActivity } from "@/services/members";
import { windowState } from "@/services/whatsapp";
import { db } from "@/db/client";
import { whatsappContacts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TicketScreen, type WaWindow } from "@/components/patch/ticket/ticket-screen";

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

  // Janela de 24h da Meta — o time precisa ver quando ela está fechando.
  let waWindow: WaWindow = null;
  if (ticket.origin === "whatsapp" && ticket.externalRef) {
    const phone = ticket.externalRef.replace(/^wa:/, "");
    const contact = await db.query.whatsappContacts.findFirst({
      where: eq(whatsappContacts.phone, phone),
    });
    const state = windowState(contact?.lastInboundAt ?? null);
    waWindow = {
      open: state.open,
      closesAt: state.closesAt ? state.closesAt.toISOString() : null,
    };
  }

  return (
    <TicketScreen
      ticket={ticket}
      messages={messagesResult.ok ? messagesResult.value : []}
      members={membersResult.ok ? membersResult.value : []}
      activity={activity}
      waWindow={waWindow}
    />
  );
}
