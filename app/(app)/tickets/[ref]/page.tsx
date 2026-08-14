import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { getTicketByNumber } from "@/services/tickets";
import { listMessages } from "@/services/messages";
import { listProjectMembers, listTicketActivity } from "@/services/members";
import { getLatestSuggestion } from "@/services/suggestions";
import { AiSuggestion, type SuggestionData } from "@/components/patch/ai/ai-suggestion";
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

  const [messagesResult, membersResult, activity, suggestionResult] =
    await Promise.all([
      listMessages(actor, ticket.id),
      listProjectMembers(actor, ticket.projectId),
      listTicketActivity(ticket.id),
      getLatestSuggestion(actor, ticket.id),
    ]);

  const members = membersResult.ok ? membersResult.value : [];
  let suggestionData: SuggestionData | null = null;
  if (suggestionResult.ok && suggestionResult.value) {
    const s = suggestionResult.value;
    suggestionData = {
      id: s.id,
      suggestedUserId: s.suggestedUserId,
      suggestedUserName: s.suggestedUserName,
      confidence: s.confidence,
      rationale: s.rationale,
      evidence: s.evidence,
      improvements: s.improvements,
      model: s.model,
      indexedAt: s.indexedAt ? s.indexedAt.toISOString() : null,
      decision: s.decision,
      decidedAt: s.decidedAt ? s.decidedAt.toISOString() : null,
      decidedByMe: s.decidedBy === actor.id,
      createdAt: s.createdAt.toISOString(),
    };
  }

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
      members={members}
      activity={activity}
      waWindow={waWindow}
      aiSlot={
        // Tasks internas não passam pela triagem — o bloco só aparece onde faz sentido
        ticket.type !== "task" ? (
          <AiSuggestion
            suggestion={suggestionData}
            members={members}
            ticketId={ticket.id}
            currentAssigneeName={ticket.assigneeName}
          />
        ) : undefined
      }
    />
  );
}
