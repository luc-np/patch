import type { ChunkMetadata } from "@/db/schema";
import { detectLanguage, isMarkdown } from "./filters";

export type Chunk = { text: string; metadata: ChunkMetadata };

const MAX_CHUNK_CHARS = 6000; // ~1.500 tokens
const CODE_WINDOW_LINES = 120;
const CODE_OVERLAP_LINES = 20;

export function chunkFile(path: string, content: string): Chunk[] {
  if (isMarkdown(path)) return chunkMarkdown(path, content);
  return chunkCode(path, content);
}

/** Markdown por heading, preservando a hierarquia no metadado. */
export function chunkMarkdown(path: string, content: string): Chunk[] {
  const lines = content.split("\n");
  const chunks: Chunk[] = [];
  const trail: { level: number; title: string }[] = [];
  let buffer: string[] = [];
  let bufferStart = 1;

  function flush(endLine: number) {
    const text = buffer.join("\n").trim();
    if (text.length > 0) {
      for (const part of splitLongText(text)) {
        chunks.push({
          text: part,
          metadata: {
            kind: "markdown",
            path,
            language: "markdown",
            startLine: bufferStart,
            endLine,
            headingTrail: trail.map((t) => t.title),
          },
        });
      }
    }
    buffer = [];
  }

  lines.forEach((line, i) => {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (match && match[1] && match[2] !== undefined) {
      flush(i);
      const level = match[1].length;
      while (trail.length > 0 && (trail[trail.length - 1]?.level ?? 0) >= level) {
        trail.pop();
      }
      trail.push({ level, title: match[2].trim() });
      bufferStart = i + 1;
    }
    buffer.push(line);
  });
  flush(lines.length);
  return chunks;
}

/** Código em janelas de linhas com sobreposição, carregando caminho e faixa. */
export function chunkCode(path: string, content: string): Chunk[] {
  const lines = content.split("\n");
  const language = detectLanguage(path);
  const chunks: Chunk[] = [];

  for (
    let start = 0;
    start < lines.length;
    start += CODE_WINDOW_LINES - CODE_OVERLAP_LINES
  ) {
    const end = Math.min(start + CODE_WINDOW_LINES, lines.length);
    const text = lines.slice(start, end).join("\n").trim();
    if (text.length > 0) {
      chunks.push({
        text: text.slice(0, MAX_CHUNK_CHARS),
        metadata: {
          kind: "code",
          path,
          language,
          startLine: start + 1,
          endLine: end,
        },
      });
    }
    if (end === lines.length) break;
  }
  return chunks;
}

function splitLongText(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const parts: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";
  for (const p of paragraphs) {
    if (current.length + p.length + 2 > MAX_CHUNK_CHARS && current) {
      parts.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
    // Parágrafo sozinho maior que o teto: corte duro.
    while (current.length > MAX_CHUNK_CHARS) {
      parts.push(current.slice(0, MAX_CHUNK_CHARS));
      current = current.slice(MAX_CHUNK_CHARS);
    }
  }
  if (current) parts.push(current);
  return parts;
}
