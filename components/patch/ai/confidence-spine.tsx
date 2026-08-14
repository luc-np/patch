import { cn } from "@/lib/utils";

/**
 * Espinha de confiança: número em mono tabular + 5 segmentos de 9px
 * empilhados de baixo para cima, preenchidos proporcionalmente.
 * A diferença entre alta e baixa é quantidade de tinta, não cor de semáforo.
 */
export function ConfidenceSpine({
  value,
  strong,
}: {
  value: number;
  /** true = confiança alta (tinta em --ai); false = baixa (tinta neutra) */
  strong: boolean;
}) {
  const filled = value * 5;

  return (
    <div className="flex w-[88px] shrink-0 flex-col items-start gap-2">
      <span
        className={cn(
          "font-mono tnum",
          strong
            ? "text-[26px] font-semibold text-ai"
            : "text-[20px] font-medium text-muted-foreground",
        )}
      >
        {value.toFixed(2)}
      </span>
      <div className="flex flex-col-reverse gap-[3px]">
        {Array.from({ length: 5 }).map((_, i) => {
          const fill = Math.max(0, Math.min(1, filled - i));
          return (
            <div
              key={i}
              className={cn(
                "h-[9px] w-9 border",
                strong ? "border-ai" : "border-muted-foreground",
              )}
              style={{
                background:
                  fill >= 1
                    ? strong
                      ? "var(--ai)"
                      : "var(--muted-foreground)"
                    : fill > 0
                      ? strong
                        ? "color-mix(in srgb, var(--ai) 30%, transparent)"
                        : "color-mix(in srgb, var(--muted-foreground) 30%, transparent)"
                      : "transparent",
              }}
            />
          );
        })}
      </div>
      <span className="font-mono text-[9.5px] text-muted-foreground tnum">
        {formatSegments(filled)} de 5 medidas
      </span>
    </div>
  );
}

function formatSegments(filled: number): string {
  const rounded = Math.round(filled * 2) / 2;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", ",");
}
