import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  users,
  projects,
  projectMembers,
  tickets,
  ticketMessages,
} from "@/db/schema";
import { getTicketByNumber } from "@/services/tickets";
import { listMessages } from "@/services/messages";
import type { Actor } from "@/lib/auth/policies";

/**
 * Integração com banco real: garante que a policy está DE FATO na frente da
 * query — um guest lendo o chamado de outro guest recebe o mesmo not_found
 * que um chamado inexistente.
 */

const run = randomUUID().slice(0, 8);
let projectId: string;
let guestA: Actor;
let guestB: Actor;
let staff: Actor;
let ticketAId: string;
let ticketANumber: number;
const createdUserIds: string[] = [];

async function createUser(name: string, role: "staff" | "guest") {
  const id = `test-${role}-${name}-${run}`;
  await db.insert(users).values({
    id,
    name,
    email: `${name}-${run}@test.local`,
    role,
    emailVerified: true,
  });
  createdUserIds.push(id);
  return id;
}

beforeAll(async () => {
  const [project] = await db
    .insert(projects)
    .values({ name: `Teste ${run}`, slug: `teste-${run}`, portalEnabled: true })
    .returning();
  if (!project) throw new Error("setup falhou");
  projectId = project.id;

  const [aId, bId, sId] = await Promise.all([
    createUser("guesta", "guest"),
    createUser("guestb", "guest"),
    createUser("staff", "staff"),
  ]);
  await db.insert(projectMembers).values([
    { projectId, userId: aId, role: "collaborator" },
    { projectId, userId: bId, role: "collaborator" },
    { projectId, userId: sId, role: "dev" },
  ]);

  guestA = { id: aId, name: "A", email: "a@t", role: "guest", projectIds: [projectId] };
  guestB = { id: bId, name: "B", email: "b@t", role: "guest", projectIds: [projectId] };
  staff = { id: sId, name: "S", email: "s@t", role: "staff", projectIds: [projectId] };

  const [ticketA] = await db
    .insert(tickets)
    .values({
      projectId,
      type: "support",
      title: "Chamado do guest A",
      body: "corpo",
      origin: "portal",
      authorId: aId,
    })
    .returning();
  if (!ticketA) throw new Error("setup falhou");
  ticketAId = ticketA.id;
  ticketANumber = ticketA.number;

  await db.insert(ticketMessages).values([
    { ticketId: ticketAId, authorId: sId, body: "resposta pública", internal: false },
    { ticketId: ticketAId, authorId: sId, body: "nota interna secreta", internal: true },
  ]);
});

afterAll(async () => {
  await db.delete(projects).where(eq(projects.id, projectId)); // cascata leva tickets/mensagens
  if (createdUserIds.length > 0)
    await db.delete(users).where(inArray(users.id, createdUserIds));
});

describe("isolamento de guest com banco real", () => {
  it("guest B não lê o chamado do guest A — mesmo not_found de um inexistente", async () => {
    const asB = await getTicketByNumber(guestB, ticketANumber);
    const missing = await getTicketByNumber(guestB, 99_999_999);
    expect(asB).toEqual(missing);
    expect(asB.ok).toBe(false);
    if (!asB.ok) expect(asB.error).toBe("not_found");
  });

  it("guest A lê o próprio chamado; staff do projeto também", async () => {
    const asA = await getTicketByNumber(guestA, ticketANumber);
    expect(asA.ok).toBe(true);
    const asStaff = await getTicketByNumber(staff, ticketANumber);
    expect(asStaff.ok).toBe(true);
  });

  it("a thread do guest A não contém a nota interna; a do staff contém", async () => {
    const forA = await listMessages(guestA, ticketAId);
    expect(forA.ok).toBe(true);
    if (forA.ok) {
      expect(forA.value.map((m) => m.body)).toEqual(["resposta pública"]);
    }
    const forStaff = await listMessages(staff, ticketAId);
    if (forStaff.ok) {
      expect(forStaff.value).toHaveLength(2);
    }
  });

  it("guest B pedindo a thread do chamado de A recebe not_found, não lista vazia", async () => {
    const forB = await listMessages(guestB, ticketAId);
    expect(forB.ok).toBe(false);
  });
});
