/**
 * TODA a autorização do Patch mora aqui, como funções puras (sem IO).
 * Convenção: leitura negada vira `not_found` no service — recurso invisível é
 * indistinguível de inexistente (404, não 403). `forbidden` (403) fica para
 * ação proibida em recurso visível.
 */

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff" | "guest";
  projectIds: string[];
};

export type TicketView = {
  projectId: string;
  authorId: string;
  type: "task" | "support" | "bug";
};

export type MessageView = { internal: boolean };

function isMember(actor: Actor, projectId: string): boolean {
  return actor.projectIds.includes(projectId);
}

/* ── Projetos ── */

export function canViewProject(actor: Actor, projectId: string): boolean {
  if (actor.role === "admin") return true;
  return isMember(actor, projectId);
}

/** Criar/editar projetos, cadastrar membros, definir áreas, configurar repos. */
export function canManageProjects(actor: Actor): boolean {
  return actor.role === "admin";
}

/* ── Tickets ── */

export function canViewTicket(actor: Actor, ticket: TicketView): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "staff") return isMember(actor, ticket.projectId);
  // Guest: apenas os chamados que ele mesmo criou — e nunca tasks internas.
  return ticket.authorId === actor.id && ticket.type !== "task";
}

export function canCreateTicket(
  actor: Actor,
  input: { projectId: string; type: "task" | "support" | "bug"; portalEnabled: boolean },
): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "staff") return isMember(actor, input.projectId);
  // Guest só abre chamado de suporte/bug via portal ligado, em projeto onde é membro.
  return (
    input.type !== "task" &&
    input.portalEnabled &&
    isMember(actor, input.projectId)
  );
}

export function canUpdateTicket(actor: Actor, ticket: TicketView): boolean {
  if (actor.role === "admin") return true;
  return actor.role === "staff" && isMember(actor, ticket.projectId);
}

export function canAssignTicket(actor: Actor, ticket: TicketView): boolean {
  return canUpdateTicket(actor, ticket);
}

export function canDecideSuggestion(actor: Actor, ticket: TicketView): boolean {
  return canUpdateTicket(actor, ticket);
}

/* ── Mensagens ── */

export function canViewMessage(
  actor: Actor,
  ticket: TicketView,
  message: MessageView,
): boolean {
  if (!canViewTicket(actor, ticket)) return false;
  if (actor.role === "guest") return !message.internal;
  return true;
}

/** Usada pelos services antes de devolver a thread — nunca por componente. */
export function filterVisibleMessages<M extends MessageView>(
  actor: Actor,
  ticket: TicketView,
  messages: M[],
): M[] {
  if (!canViewTicket(actor, ticket)) return [];
  if (actor.role === "guest") return messages.filter((m) => !m.internal);
  return messages;
}

export function canPostMessage(actor: Actor, ticket: TicketView): boolean {
  return canViewTicket(actor, ticket);
}

export function canPostInternalNote(actor: Actor, ticket: TicketView): boolean {
  if (actor.role === "guest") return false;
  return canViewTicket(actor, ticket);
}

/* ── Equipe, expertise e conhecimento ── */

export function canViewTeam(actor: Actor): boolean {
  return actor.role !== "guest";
}

export function canManageExpertise(actor: Actor): boolean {
  return actor.role === "admin";
}

export function canViewProjectNotes(actor: Actor, projectId: string): boolean {
  if (actor.role === "guest") return false;
  return canViewProject(actor, projectId);
}

export function canEditProjectNotes(actor: Actor, projectId: string): boolean {
  return canViewProjectNotes(actor, projectId);
}

export function canViewSuggestions(actor: Actor, ticket: TicketView): boolean {
  if (actor.role === "guest") return false;
  return canViewTicket(actor, ticket);
}

export function canTriggerIngestion(actor: Actor, projectId: string): boolean {
  if (actor.role === "guest") return false;
  return canViewProject(actor, projectId);
}

export function canProposeMarkdownPr(actor: Actor, projectId: string): boolean {
  if (actor.role === "guest") return false;
  return canViewProject(actor, projectId);
}
