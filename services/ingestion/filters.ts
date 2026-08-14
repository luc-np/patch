/** Filtro de entrada da ingestão: o que nem chega a ser lido. */

const SKIP_DIRS = [
  "node_modules/",
  "vendor/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  ".git/",
  "__pycache__/",
  "target/",
  ".venv/",
];

const SKIP_FILES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "composer.lock",
  "Gemfile.lock",
  "Cargo.lock",
  "poetry.lock",
  "uv.lock",
  "go.sum",
];

const SKIP_EXTENSIONS = [
  // binários e mídia
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".pdf",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".zip", ".gz", ".tar", ".rar", ".7z",
  ".mp3", ".mp4", ".mov", ".avi", ".webm",
  ".exe", ".dll", ".so", ".dylib", ".wasm", ".bin",
  ".jar", ".class", ".pyc",
  // derivados
  ".min.js", ".min.css", ".map",
];

export function shouldSkipPath(path: string): string | null {
  const lower = path.toLowerCase();
  if (SKIP_DIRS.some((d) => lower.includes(d))) return "diretório ignorado";
  const base = path.split("/").pop() ?? path;
  if (SKIP_FILES.includes(base)) return "lockfile";
  if (SKIP_EXTENSIONS.some((e) => lower.endsWith(e))) return "binário/minificado";
  return null;
}

export function shouldSkipContent(
  buffer: Buffer,
  maxBytes: number,
): string | null {
  if (buffer.byteLength > maxBytes) return `acima do limite (${buffer.byteLength} bytes)`;
  // Byte NUL nos primeiros 8KB = binário.
  const probe = buffer.subarray(0, 8192);
  if (probe.includes(0)) return "binário";
  return null;
}

export function isMarkdown(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".mdx");
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin",
  php: "php", cs: "csharp", c: "c", h: "c", cpp: "cpp", hpp: "cpp",
  sql: "sql", sh: "shell", bash: "shell", yml: "yaml", yaml: "yaml",
  json: "json", css: "css", scss: "scss", html: "html", md: "markdown",
};

export function detectLanguage(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext ? LANGUAGE_BY_EXT[ext] : undefined;
}
