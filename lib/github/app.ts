import { App, Octokit } from "octokit";
import { getEnv } from "@/lib/env";
import { ok, err, type Result } from "@/lib/result";

/**
 * Acesso ao GitHub via GitHub App (leitura de conteúdo + escrita de PR) —
 * nunca PAT pessoal. O installation_id é resolvido por repositório e fica
 * salvo em projects.gh_installation_id.
 */

let app: App | null = null;

function getApp(): Result<App, "not_configured"> {
  const env = getEnv();
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    return err(
      "not_configured",
      "GitHub App não configurado (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY).",
    );
  }
  if (!app) {
    app = new App({
      appId: env.GITHUB_APP_ID,
      // No Render a chave vem com \n escapado na env var
      privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }
  return ok(app);
}

export function parseRepoUrl(
  repoUrl: string,
): Result<{ owner: string; repo: string }, "invalid_repo_url"> {
  const match = /github\.com[/:]([^/]+)\/([^/.]+)/.exec(repoUrl);
  if (!match || !match[1] || !match[2]) {
    return err("invalid_repo_url", "A URL do repositório não é do GitHub.");
  }
  return ok({ owner: match[1], repo: match[2] });
}

export async function getInstallationOctokit(
  repoUrl: string,
  knownInstallationId: number | null,
): Promise<
  Result<
    { octokit: Octokit; owner: string; repo: string; installationId: number },
    "not_configured" | "invalid_repo_url" | "not_installed"
  >
> {
  const appResult = getApp();
  if (!appResult.ok) return appResult;
  const repoResult = parseRepoUrl(repoUrl);
  if (!repoResult.ok) return repoResult;
  const { owner, repo } = repoResult.value;

  let installationId = knownInstallationId;
  if (!installationId) {
    try {
      const { data } = await appResult.value.octokit.request(
        "GET /repos/{owner}/{repo}/installation",
        { owner, repo },
      );
      installationId = data.id;
    } catch {
      return err(
        "not_installed",
        "A GitHub App do Patch não está instalada neste repositório.",
      );
    }
  }

  const octokit = await appResult.value.getInstallationOctokit(installationId);
  return ok({ octokit, owner, repo, installationId });
}
