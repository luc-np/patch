/** Diff de linhas por LCS — suficiente para revisar edições de .md na UI. */

export type DiffLine = { type: "ctx" | "del" | "add"; text: string };

const MAX_LINES = 1500;

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");

  // Arquivos enormes: mostra só um resumo bruto em vez de estourar memória.
  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return [
      { type: "del", text: `(arquivo original com ${a.length} linhas)` },
      { type: "add", text: `(nova versão com ${b.length} linhas — grande demais para diff inline)` },
    ];
  }

  // Poda prefixo/sufixo comuns antes do DP
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  const n = midA.length;
  const m = midB.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        midA[i] === midB[j]
          ? (lcs[i + 1]![j + 1] ?? 0) + 1
          : Math.max(lcs[i + 1]![j] ?? 0, lcs[i]![j + 1] ?? 0);
    }
  }

  const out: DiffLine[] = a.slice(0, start).map((text) => ({ type: "ctx" as const, text }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      out.push({ type: "ctx", text: midA[i] ?? "" });
      i++;
      j++;
    } else if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) {
      out.push({ type: "del", text: midA[i] ?? "" });
      i++;
    } else {
      out.push({ type: "add", text: midB[j] ?? "" });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: midA[i++] ?? "" });
  while (j < m) out.push({ type: "add", text: midB[j++] ?? "" });
  out.push(...a.slice(endA).map((text) => ({ type: "ctx" as const, text })));

  return out;
}

/** Colapsa contexto longe das mudanças para a UI (mantém k linhas de cada lado). */
export function collapseContext(lines: DiffLine[], k = 3): (DiffLine | { type: "skip"; count: number })[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, idx) => {
    if (line.type !== "ctx") {
      for (let d = -k; d <= k; d++) {
        const pos = idx + d;
        if (pos >= 0 && pos < lines.length) keep[pos] = true;
      }
    }
  });
  const out: (DiffLine | { type: "skip"; count: number })[] = [];
  let skipped = 0;
  lines.forEach((line, idx) => {
    if (keep[idx]) {
      if (skipped > 0) {
        out.push({ type: "skip", count: skipped });
        skipped = 0;
      }
      out.push(line);
    } else {
      skipped++;
    }
  });
  if (skipped > 0) out.push({ type: "skip", count: skipped });
  return out;
}
