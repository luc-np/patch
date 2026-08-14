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
import { memberRole, expertiseSource } from "./enums";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  repoUrl: text("repo_url"),
  defaultBranch: text("default_branch").notNull().default("main"),
  portalEnabled: boolean("portal_enabled").notNull().default(false),
  ghInstallationId: integer("gh_installation_id"),
  // cor do portal público; fallback é o accent da IA
  accentColor: text("accent_color"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("project_members_project_user_uq").on(t.projectId, t.userId),
    index("project_members_user_idx").on(t.userId),
  ],
);

export const expertiseAreas = pgTable(
  "expertise_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** globs de caminho associados à área, ex.: ["src/checkout/**", "docs/checkout*.md"] */
    globs: jsonb("globs").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("expertise_areas_project_name_uq").on(t.projectId, t.name)],
);

export const memberExpertise = pgTable(
  "member_expertise",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    areaId: uuid("area_id")
      .notNull()
      .references(() => expertiseAreas.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** manual é o seed declarado; o sinal do git acumula em linha própria e nunca vira declarado */
    source: expertiseSource("source").notNull(),
    weight: real("weight").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("member_expertise_area_user_source_uq").on(
      t.areaId,
      t.userId,
      t.source,
    ),
  ],
);

export const codeOwnership = pgTable(
  "code_ownership",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    authorEmail: text("author_email").notNull(),
    /** match author_email → users.email; nulo quando o autor não é usuário do app */
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    commitCount: integer("commit_count").notNull().default(0),
    lastCommitAt: timestamp("last_commit_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("code_ownership_project_path_author_uq").on(
      t.projectId,
      t.path,
      t.authorEmail,
    ),
    index("code_ownership_project_path_idx").on(t.projectId, t.path),
  ],
);
