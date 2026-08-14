import { describe, it, expect } from "vitest";
import {
  isForbiddenPath,
  scrubContent,
  shannonEntropy,
} from "@/services/ingestion/scrub";

describe("scrub de segredos — cobertura obrigatória", () => {
  it("descarta .env e derivados pelo caminho, sem nem ler o conteúdo", () => {
    expect(isForbiddenPath(".env")).toBe(true);
    expect(isForbiddenPath(".env.local")).toBe(true);
    expect(isForbiddenPath("apps/web/.env.production")).toBe(true);
    expect(isForbiddenPath("deploy/key.pem")).toBe(true);
    expect(isForbiddenPath("ops/id_rsa")).toBe(true);
    expect(isForbiddenPath("gcp/credentials.json")).toBe(true);
    // não pode virar paranoia
    expect(isForbiddenPath("src/environment.ts")).toBe(false);
    expect(isForbiddenPath("docs/env-vars.md")).toBe(false);
  });

  it("detecta os formatos de chave conhecidos por regex", () => {
    const cases: [string, string][] = [
      ["aws", "aws_access_key_id = AKIAIOSFODNN7EXAMPLE"],
      ["github", "token: ghp_16C7e42F292c6912E7710c838347Ae178B4a"],
      ["anthropic", "ANTHROPIC=sk-ant-api03-abc123def456ghi789jkl"],
      ["slack", "url = xoxb-2444333222111-333222111000-AbCdEfGhIjKlMnOpQrStUvWx"],
      ["google", "key=AIzaSyA-1234567890abcdefghijklmnopqrstu"],
      ["private key", "-----BEGIN RSA PRIVATE KEY-----\nMIIE..."],
      ["connection string", "db: postgres://admin:hunter22secret@db.example.com:5432/app"],
      ["stripe", "sk_live_4eC39HqLyjWDarjtT1zdp7dcAbCdEfGh"],
    ];
    for (const [name, content] of cases) {
      const verdict = scrubContent(content);
      expect(verdict.clean, `deveria descartar: ${name}`).toBe(false);
    }
  });

  it("detecta segredo genérico por entropia quando há dica de atribuição", () => {
    const secret = "API_SECRET=vX9mQ2zK8fLw3RtY7nB4cJ6hD1gS5aE0pUoI2yTqW8eM";
    expect(scrubContent(secret).clean).toBe(false);
  });

  it("NÃO descarta código normal, hash de exemplo em doc, nem import longo", () => {
    const ok = [
      "import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'",
      "const checksum = sha256(fileContents); // integridade do arquivo",
      "## Como rodar\n\nnpm install && npm run dev",
      "expect(chunkMarkdown(path, content)).toHaveLength(3)",
      "className=\"flex min-h-0 flex-1 flex-col overflow-hidden\"",
    ].join("\n");
    expect(scrubContent(ok).clean).toBe(true);
  });

  it("entropia de shannon se comporta como esperado", () => {
    expect(shannonEntropy("aaaaaaaaaa")).toBe(0);
    expect(shannonEntropy("vX9mQ2zK8fLw3RtY7nB4cJ6hD1gS5aE0")).toBeGreaterThan(4.5);
  });
});
