import "dotenv/config";
import { describe, it, expect } from "vitest";
import { rrfFuse } from "@/services/search";

const row = (chunkId: string) => ({ chunkId });

describe("Reciprocal Rank Fusion", () => {
  it("quem aparece bem nas duas listas vence quem lidera só uma", () => {
    const vector = [row("a"), row("b"), row("c")];
    const fts = [row("d"), row("b"), row("a")];
    const fused = rrfFuse([vector, fts], { k: 60, limit: 4 });
    // b: 1/62 + 1/62 · a: 1/61 + 1/63 — a soma de a é ligeiramente maior
    expect(fused.map((f) => f.chunkId).slice(0, 2).sort()).toEqual(["a", "b"]);
    const [first] = fused;
    expect(first).toBeDefined();
    // d (1º só no fts) não pode vencer a e b, presentes em ambas
    expect(fused.findIndex((f) => f.chunkId === "d")).toBeGreaterThan(
      fused.findIndex((f) => f.chunkId === "b"),
    );
  });

  it("lista única degrada para a própria ordem", () => {
    const fused = rrfFuse([[row("x"), row("y"), row("z")]], { limit: 10 });
    expect(fused.map((f) => f.chunkId)).toEqual(["x", "y", "z"]);
  });

  it("respeita o limite e devolve score decrescente", () => {
    const a = Array.from({ length: 40 }, (_, i) => row(`a${i}`));
    const b = Array.from({ length: 40 }, (_, i) => row(`a${39 - i}`));
    const fused = rrfFuse([a, b], { limit: 12 });
    expect(fused).toHaveLength(12);
    for (let i = 1; i < fused.length; i++) {
      const prev = fused[i - 1];
      const curr = fused[i];
      if (prev && curr) expect(prev.score).toBeGreaterThanOrEqual(curr.score);
    }
  });
});
