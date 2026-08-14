type Shortcut = { keys: string[]; label: string };

/** Barra fixa de 28px no rodapé: teclas em caixa de 1px, mono 10.5px. */
export function ShortcutBar({
  shortcuts,
  right,
}: {
  shortcuts: Shortcut[];
  right?: React.ReactNode;
}) {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border px-3 font-mono text-[10.5px] text-muted-foreground">
      {shortcuts.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5">
          {s.keys.map((k) => (
            <kbd
              key={k}
              className="border border-border px-1 leading-[14px] text-foreground"
            >
              {k}
            </kbd>
          ))}
          <span>{s.label}</span>
        </span>
      ))}
      {right && <span className="ml-auto">{right}</span>}
    </footer>
  );
}
