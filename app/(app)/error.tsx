"use client";

/** Erro honesto e específico: o que aconteceu, o que não foi perdido, e duas saídas. */
export default function QueueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const at = new Date().toLocaleTimeString("pt-BR");
  return (
    <div className="px-8 py-16">
      <div className="h-0 w-14 border-t-2 border-ai" aria-hidden />
      <h2 className="mt-5 text-[26px]">Não consegui carregar a fila.</h2>
      <p className="mt-3 max-w-[56ch] text-[14px] text-muted-foreground">
        Nada foi perdido: os chamados continuam no banco e novas entradas seguem
        sendo registradas. Só esta tela não conseguiu buscar os dados.
      </p>
      <pre className="mt-5 max-w-[64ch] overflow-x-auto border border-border bg-card p-3 font-mono text-[11px] leading-relaxed">
        {`GET /  →  erro interno`}
        {error.digest ? `\nreq_id ${error.digest}` : ""}
        {`  ·  ${at}`}
      </pre>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex h-8 items-center bg-ai px-3 text-[13px] font-medium text-ai-foreground hover:bg-ai-strong"
        >
          Tentar carregar de novo
        </button>
        <a
          href="https://status.render.com"
          target="_blank"
          rel="noreferrer"
          className="flex h-8 items-center border border-input px-3 text-[13px] font-medium hover:bg-accent"
        >
          Ver status dos serviços
        </a>
      </div>
    </div>
  );
}
