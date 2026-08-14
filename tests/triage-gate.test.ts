import "dotenv/config";
import { describe, it, expect } from "vitest";
import { applyConfidenceGate } from "@/services/triage";

const valid = new Set(["u-marina", "u-diego"]);
const MIN = 0.55;

describe("gate de confiança da triagem", () => {
  it("sugestão válida acima do limite passa intacta", () => {
    const out = applyConfidenceGate(
      {
        suggestedUserId: "u-marina",
        confidence: 0.86,
        rationale: "9 dos 11 commits em src/checkout são dela",
        improvements: [],
      },
      valid,
      MIN,
    );
    expect(out.suggestedUserId).toBe("u-marina");
    expect(out.confidence).toBe(0.86);
  });

  it("confiança abaixo do limite vira sem-sugestão, com explicação", () => {
    const out = applyConfidenceGate(
      {
        suggestedUserId: "u-diego",
        confidence: 0.41,
        rationale: "sinal fraco",
        improvements: [],
      },
      valid,
      MIN,
    );
    expect(out.suggestedUserId).toBeNull();
    expect(out.rationale).toContain("abaixo do limite");
    // sem sugestão sempre traz ações concretas para o estado ausente da UI
    expect(out.improvements.length).toBeGreaterThanOrEqual(2);
  });

  it("id inventado pelo modelo é descartado, nunca exibido", () => {
    const out = applyConfidenceGate(
      {
        suggestedUserId: "u-fantasma",
        confidence: 0.95,
        rationale: "alucinação convicta",
        improvements: [],
      },
      valid,
      MIN,
    );
    expect(out.suggestedUserId).toBeNull();
    expect(out.confidence).toBe(0);
  });

  it("sem-sugestão do próprio modelo preserva rationale e improvements", () => {
    const out = applyConfidenceGate(
      {
        suggestedUserId: null,
        confidence: 0.2,
        rationale: "o arquivo entrou pela migração de março sem histórico",
        improvements: ["reindexar o repo", "declarar dono de src/fiscal"],
      },
      valid,
      MIN,
    );
    expect(out.suggestedUserId).toBeNull();
    expect(out.rationale).toContain("migração de março");
    expect(out.improvements).toEqual([
      "reindexar o repo",
      "declarar dono de src/fiscal",
    ]);
  });
});
