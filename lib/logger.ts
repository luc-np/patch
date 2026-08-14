import { randomUUID } from "node:crypto";

type Level = "debug" | "info" | "warn" | "error";

export type Logger = {
  correlationId: string;
  debug: (msg: string, data?: Record<string, unknown>) => void;
  info: (msg: string, data?: Record<string, unknown>) => void;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
};

function emit(
  level: Level,
  correlationId: string,
  bindings: Record<string, unknown>,
  msg: string,
  data?: Record<string, unknown>,
) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    correlationId,
    msg,
    ...bindings,
    ...data,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(
  correlationId: string = randomUUID().slice(0, 8),
  bindings: Record<string, unknown> = {},
): Logger {
  return {
    correlationId,
    debug: (msg, data) => emit("debug", correlationId, bindings, msg, data),
    info: (msg, data) => emit("info", correlationId, bindings, msg, data),
    warn: (msg, data) => emit("warn", correlationId, bindings, msg, data),
    error: (msg, data) => emit("error", correlationId, bindings, msg, data),
    child: (extra) => createLogger(correlationId, { ...bindings, ...extra }),
  };
}
