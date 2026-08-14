import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID, createHmac } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import {
  users,
  projects,
  projectMembers,
  tickets,
  ticketMessages,
  whatsappContacts,
} from "@/db/schema";
import { processInbound } from "@/services/whatsapp";
import { verifyWebhookSignature } from "@/lib/whatsapp/verify";
import { createLogger } from "@/lib/logger";

const run = randomUUID().slice(0, 8);
const phone = `55119${run.replace(/\D/g, "9").slice(0, 8)}`;
let projectId: string;

beforeAll(async () => {
  const [project] = await db
    .insert(projects)
    .values({ name: `WA Teste ${run}`, slug: `wa-teste-${run}`, portalEnabled: true })
    .returning();
  if (!project) throw new Error("setup falhou");
  projectId = project.id;

  // Contato já conhecido: o caso de telefone desconhecido depende de env e é
  // coberto manualmente; aqui interessa a idempotência do processamento.
  const userId = `wa-${phone}`;
  await db.insert(users).values({
    id: userId,
    name: `WhatsApp +${phone}`,
    email: `+${phone}@wa.invalid`,
    role: "guest",
  });
  await db
    .insert(projectMembers)
    .values({ projectId, userId, role: "collaborator" });
  await db.insert(whatsappContacts).values({ phone, userId, projectId });
});

afterAll(async () => {
  await db.delete(projects).where(eq(projects.id, projectId));
  await db.delete(users).where(eq(users.id, `wa-${phone}`));
});

describe("idempotência do inbound de WhatsApp", () => {
  it("reprocessar o MESMO message_id duas vezes gera um único chamado e uma única mensagem", async () => {
    const log = createLogger("test");
    const payload = {
      messageId: `wamid.${run}`,
      from: phone,
      text: "Meu pedido sumiu do app",
      timestamp: Math.floor(Date.now() / 1000),
    };

    await processInbound(payload, log); // primeira entrega
    await processInbound(payload, log); // re-entrega da Meta

    const created = await db.query.tickets.findMany({
      where: and(eq(tickets.projectId, projectId), eq(tickets.origin, "whatsapp")),
    });
    expect(created).toHaveLength(1);

    const messages = await db.query.ticketMessages.findMany({
      where: eq(ticketMessages.externalId, payload.messageId),
    });
    expect(messages).toHaveLength(1);
  });

  it("mensagem NOVA do mesmo contato com chamado aberto anexa à thread, não abre outro", async () => {
    const log = createLogger("test");
    await processInbound(
      {
        messageId: `wamid.${run}-2`,
        from: phone,
        text: "Consegui um print do erro",
        timestamp: Math.floor(Date.now() / 1000),
      },
      log,
    );

    const created = await db.query.tickets.findMany({
      where: and(eq(tickets.projectId, projectId), eq(tickets.origin, "whatsapp")),
    });
    expect(created).toHaveLength(1);

    const first = created[0];
    if (!first) throw new Error("sem ticket");
    const thread = await db.query.ticketMessages.findMany({
      where: eq(ticketMessages.ticketId, first.id),
    });
    expect(thread).toHaveLength(2);
  });
});

describe("assinatura do webhook", () => {
  const secret = "segredo-de-teste";
  const body = JSON.stringify({ entry: [] });

  it("aceita assinatura correta e recusa incorreta/ausente", () => {
    const good = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyWebhookSignature(body, good, secret)).toBe(true);
    expect(verifyWebhookSignature(body, `sha256=${"0".repeat(64)}`, secret)).toBe(false);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body + " ", good, secret)).toBe(false);
  });
});
