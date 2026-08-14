import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { getActor } from "@/lib/auth/session";
import { canViewSuggestions } from "@/lib/auth/policies";
import { enqueue, QUEUE } from "@/lib/queue";
import { randomUUID } from "node:crypto";

/**
 * POST /api/suggest/:id — reenfileira a triagem de um ticket.
 * Endpoint separado de propósito: a sugestão pode falhar sozinha e demora
 * mais — a conversa nunca espera por ela.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, id) });
  if (!ticket || !canViewSuggestions(actor, ticket)) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  await enqueue(
    QUEUE.triage,
    { ticketId: id, correlationId: randomUUID().slice(0, 8) },
    { retryLimit: 3, retryBackoff: true, singletonKey: id },
  );
  return NextResponse.json({ ok: true });
}
