"use client";

import { useEffect } from "react";

export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Atalhos de tecla única (j, k, enter, a, i, /, t, esc).
 * Ignorados quando o foco está em campo de texto — exceto Escape, que sempre vale.
 */
export function useShortcuts(map: ShortcutMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key === "Escape" ? "esc" : e.key.toLowerCase();
      if (key !== "esc" && isTypingTarget(e.target)) return;
      const handler = map[key];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [map, enabled]);
}
