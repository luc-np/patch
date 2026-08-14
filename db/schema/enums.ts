import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "staff", "guest"]);

export const memberRole = pgEnum("member_role", [
  "dev",
  "cs",
  "qa",
  "designer",
  "po",
  "collaborator",
]);

export const ticketType = pgEnum("ticket_type", ["task", "support", "bug"]);

export const ticketStatus = pgEnum("ticket_status", [
  "open",
  "in_analysis",
  "waiting_author",
  "in_review",
  "resolved",
  "closed",
]);

export const ticketPriority = pgEnum("ticket_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const ticketOrigin = pgEnum("ticket_origin", [
  "portal",
  "whatsapp",
  "internal",
]);

export const expertiseSource = pgEnum("expertise_source", ["manual", "git"]);

export const documentSource = pgEnum("document_source", [
  "repo_file",
  "project_note",
  "ticket",
]);

export const ingestionStatus = pgEnum("ingestion_status", [
  "running",
  "success",
  "failed",
]);

export const suggestionDecision = pgEnum("suggestion_decision", [
  "pending",
  "accepted",
  "rejected",
]);
