"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { useShortcuts } from "@/hooks/use-shortcuts";

const ORDER = ["system", "light", "dark"] as const;
const LABEL: Record<string, string> = {
  system: "sistema",
  light: "claro",
  dark: "escuro",
};

/** Alternador de tema do header — cicla sistema → claro → escuro; atalho `t`. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cycle = useCallback(() => {
    const current = ORDER.indexOf((theme ?? "system") as (typeof ORDER)[number]);
    const next = ORDER[(current + 1) % ORDER.length] ?? "system";
    setTheme(next);
  }, [theme, setTheme]);

  useShortcuts({ t: cycle });

  return (
    <button
      type="button"
      onClick={cycle}
      className="font-mono text-[10.5px] text-muted-foreground hover:text-foreground"
      title="Alternar tema (t)"
    >
      tema: {mounted ? (LABEL[theme ?? "system"] ?? "sistema") : "sistema"}
    </button>
  );
}
