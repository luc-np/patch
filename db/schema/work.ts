import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  real,
  uuid,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { projects } from "./core";
import {
  ticketType,
  ticketStatus,
  ticketPriority,
  ticketOrigin,
  suggestionDecision,
} from "./enums";

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** número sequencial exibido como PT-<n> (só no app interno; o portal não mostra) */
    number: integer("number").generatedAlwaysAsIdentity(),
    type: ticketType("type").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    status: ticketStatus("status").notNull().default("open"),
    priority: ticketPriority("priority").notNull().default("normal"),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    assigneeId: text("assignee_id").references(() => users.id),
    origin: ticketOrigin("origin").notNull(),
    /** referência externa (ex.: wa:<phone> para chamados de WhatsApp) */
    externalRef: text("external_ref"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tickets_number_uq").on(t.number),
    index("tickets_project_status_idx").on(t.projectId, t.status),
    index("tickets_assignee_idx").on(t.assigneeId),
    index("tickets_author_idx").on(t.authorId),
  ],
);

export type MessageDelivery = {
  channel: "email" | "whatsapp";
  status: "queued" | "sent" | "failed" | "window_closed";
  waMessageId?: string;
  error?: string;
};

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    /** nulo para mensagens de sistema */
    authorId: text("author_id").references(() => users.id),
    body: text("body").notNull(),
    /** nota interna: o autor externo nunca vê */
    internal: boolean("internal").notNull().default(false),
    /** id externo (message_id do WhatsApp) — unique garante idempotência na re-entrega */
    externalId: text("external_id"),
    delivery: jsonb("delivery").$type<MessageDelivery | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ticket_messages_external_id_uq").on(t.externalId),
    index("ticket_messages_ticket_idx").on(t.ticketId),
  ],
);

export type SuggestionEvidence = {
  path: string;
  startLine?: number;
  endLine?: number;
  excerpt?: string;
  reason: string;
};

export const assignmentSuggestions = pgTable(
  "assignment_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    /** nulo = "não há sinal suficiente" — também é uma resposta e fica registrada */
    suggestedUserId: text("suggested_user_id").references(() => users.id),
    rationale: text("rationale").notNull(),
    confidence: real("confidence").notNull(),
    evidence: jsonb("evidence").$type<SuggestionEvidence[]>().notNull().default([]),
    /** o que tornaria a sugestão possível, quando não há sinal (estado ausente da UI) */
    improvements: jsonb("improvements").$type<string[]>().notNull().default([]),
    model: text("model").notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    decision: suggestionDecision("decision").notNull().default("pending"),
    decidedBy: text("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("assignment_suggestions_ticket_idx").on(t.ticketId, t.createdAt)],
);
