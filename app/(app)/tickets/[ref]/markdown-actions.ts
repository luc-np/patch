"use server";

import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import {
  proposeMarkdownEdit,
  openMarkdownPr,
  type MarkdownProposal,
} from "@/services/markdown-pr";

const proposeSchema = z.object({
  ticketId: z.uuid(),
  path: z.string().min(1).max(500),
  instruction: z.string().min(5).max(5000),
});

export async function proposeMarkdownAction(input: {
  ticketId: string;
  path: string;
  instruction: string;
}): Promise<{ ok: boolean; proposal?: MarkdownProposal; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada." };
  const parsed = proposeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Informe o caminho do .md e a instrução." };
  }

  const result = await proposeMarkdownEdit(actor, parsed.data);
  if (!result.ok) {
    return { ok: false, error: result.message ?? mapError(result.error) };
  }
  return { ok: true, proposal: result.value };
}

const openSchema = z.object({
  ticketId: z.uuid(),
  path: z.string().min(1).max(500),
  newContent: z.string().max(500_000),
  fileSha: z.string(),
  baseSha: z.string(),
  branch: z.string().min(1).max(200),
});

export async function openPrAction(input: {
  ticketId: string;
  path: string;
  newContent: string;
  fileSha: string;
  baseSha: string;
  branch: string;
}): Promise<{ ok: boolean; prUrl?: string; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Sessão expirada." };
  const parsed = openSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Proposta inválida." };

  const result = await openMarkdownPr(actor, parsed.data);
  if (!result.ok) {
    return { ok: false, error: result.message ?? mapError(result.error) };
  }
  return { ok: true, prUrl: result.value.prUrl };
}

function mapError(code: string): string {
  const map: Record<string, string> = {
    not_found: "Chamado ou repositório não encontrado.",
    not_configured: "GitHub App não configurado neste ambiente.",
    not_installed: "A GitHub App do Patch não está instalada neste repositório.",
    invalid_repo_url: "A URL do repositório não é do GitHub.",
    not_markdown: "Só arquivos .md podem ser editados por aqui.",
    file_missing: "Arquivo não encontrado na branch padrão.",
    generation_failed: "A IA não conseguiu gerar a edição agora.",
    pr_failed: "Não deu para abrir o PR — confira as permissões da App.",
  };
  return map[code] ?? "Não deu para completar agora.";
}
