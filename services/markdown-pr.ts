import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, tickets, ticketMessages } from "@/db/schema";
import { canProposeMarkdownPr, type Actor } from "@/lib/auth/policies";
import { ok, err, type Result, type NotFound } from "@/lib/result";
import { getAiProvider } from "@/lib/ai/provider";
import { getInstallationOctokit } from "@/lib/github/app";
import { logAudit } from "@/lib/audit";
import { formatTicketRef } from "@/lib/format";

export type MarkdownProposal = {
  path: string;
  baseSha: string;
  fileSha: string;
  currentContent: string;
  newContent: string;
  suggestedBranch: string;
};

type PrError =
  | NotFound
  | "not_configured"
  | "invalid_repo_url"
  | "not_installed"
  | "not_markdown"
  | "file_missing"
  | "generation_failed"
  | "pr_failed";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function loadTicketWithProject(actor: Actor, ticketId: string) {
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
  if (!ticket || !canProposeMarkdownPr(actor, ticket.projectId)) return null;
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, ticket.projectId),
  });
  if (!project?.repoUrl) return null;
  return { ticket, project };
}

/**
 * Passo 1 (sob demanda, nunca automático): a IA gera a nova versão do .md.
 * O diff é confirmado por um humano ANTES de qualquer escrita no GitHub.
 */
export async function proposeMarkdownEdit(
  actor: Actor,
  input: { ticketId: string; path: string; instruction: string },
): Promise<Result<MarkdownProposal, PrError>> {
  // Nunca tocar em arquivo que não seja .md nesta fase.
  if (!/\.mdx?$/i.test(input.path)) {
    return err("not_markdown", "Só arquivos .md podem ser editados por aqui.");
  }
  const loaded = await loadTicketWithProject(actor, input.ticketId);
  if (!loaded) return err("not_found");
  const { ticket, project } = loaded;

  const ghResult = await getInstallationOctokit(
    project.repoUrl!,
    project.ghInstallationId,
  );
  if (!ghResult.ok) return ghResult;
  const { octokit, owner, repo, installationId } = ghResult.value;

  if (installationId !== project.ghInstallationId) {
    await db
      .update(projects)
      .set({ ghInstallationId: installationId })
      .where(eq(projects.id, project.id));
  }

  // O arquivo precisa existir na branch padrão — validado no servidor.
  let currentContent: string;
  let fileSha: string;
  let baseSha: string;
  try {
    const { data: refData } = await octokit.request(
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      { owner, repo, ref: `heads/${project.defaultBranch}` },
    );
    baseSha = refData.object.sha;

    const { data: file } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      { owner, repo, path: input.path, ref: project.defaultBranch },
    );
    if (Array.isArray(file) || file.type !== "file" || !("content" in file)) {
      return err("file_missing", "Este caminho não é um arquivo no repositório.");
    }
    currentContent = Buffer.from(file.content, "base64").toString("utf8");
    fileSha = file.sha;
  } catch {
    return err("file_missing", "Arquivo não encontrado na branch padrão.");
  }

  let newContent: string;
  try {
    const generated = await getAiProvider().generateMarkdownEdit({
      path: input.path,
      currentContent,
      instruction: input.instruction,
      ticketContext: `${ticket.title}\n\n${ticket.body}\n\nResolução: ${ticket.resolution ?? "—"}`,
    });
    newContent = generated.newContent;
  } catch (e) {
    return err("generation_failed", String(e));
  }

  return ok({
    path: input.path,
    baseSha,
    fileSha,
    currentContent,
    newContent,
    suggestedBranch: `patch/pt-${ticket.number}-${slugify(ticket.title)}`,
  });
}

/**
 * Passo 2, após confirmação humana do diff:
 * criar branch → commit do .md → abrir PR → devolver o link.
 * Nunca commit direto na branch padrão.
 */
export async function openMarkdownPr(
  actor: Actor,
  input: {
    ticketId: string;
    path: string;
    newContent: string;
    fileSha: string;
    baseSha: string;
    branch: string;
  },
): Promise<Result<{ prUrl: string }, PrError>> {
  if (!/\.mdx?$/i.test(input.path)) return err("not_markdown");
  const loaded = await loadTicketWithProject(actor, input.ticketId);
  if (!loaded) return err("not_found");
  const { ticket, project } = loaded;

  const ghResult = await getInstallationOctokit(
    project.repoUrl!,
    project.ghInstallationId,
  );
  if (!ghResult.ok) return ghResult;
  const { octokit, owner, repo } = ghResult.value;

  const ref = formatTicketRef(ticket.number);
  try {
    await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
      owner,
      repo,
      ref: `refs/heads/${input.branch}`,
      sha: input.baseSha,
    });

    await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path: input.path,
      branch: input.branch,
      message: `docs: atualiza ${input.path} (${ref})`,
      content: Buffer.from(input.newContent, "utf8").toString("base64"),
      sha: input.fileSha,
    });

    const { data: pr } = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      title: `docs: ${ticket.title} (${ref})`,
      head: input.branch,
      base: project.defaultBranch,
      body: `Edição de documentação proposta pela IA do Patch a partir do chamado **${ref} — ${ticket.title}**, revisada e aprovada por um humano antes da abertura deste PR.\n\nArquivo: \`${input.path}\``,
    });

    // O link vira nota interna no chamado + trilha de auditoria
    await db.insert(ticketMessages).values({
      ticketId: ticket.id,
      authorId: actor.id,
      internal: true,
      body: `PR de documentação aberto: ${pr.html_url}`,
    });
    await logAudit({
      actorUserId: actor.id,
      actorKind: "ai",
      action: "markdown_pr.opened",
      entityType: "ticket",
      entityId: ticket.id,
      metadata: { path: input.path, prUrl: pr.html_url, branch: input.branch },
    });

    return ok({ prUrl: pr.html_url });
  } catch (e) {
    return err("pr_failed", String(e));
  }
}
