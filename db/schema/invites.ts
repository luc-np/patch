import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { projects } from "./core";
import { memberRole } from "./enums";

/**
 * Convite de equipe: admin convida por e-mail com projeto + função.
 * O clique no link prova a posse do e-mail — a conta nasce verificada.
 */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** token opaco da URL do convite */
    token: uuid("token").notNull().unique().defaultRandom(),
    email: text("email").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("invites_email_idx").on(t.email)],
);
