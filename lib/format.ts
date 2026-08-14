/** Formatação compartilhada entre telas — datas em pt-BR, refs em mono. */

export function formatTicketRef(number: number): string {
  return `PT-${number}`;
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

/** "agora", "12min", "3h", "ontem", "14/08" — curto, para a coluna `atualizado`. */
export function formatShortTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24 && isToday(date)) return `${diffH}h`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  )
    return "ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export const STATUS_LABEL: Record<string, string> = {
  open: "aberto",
  in_analysis: "em análise",
  waiting_author: "aguardando autor",
  in_review: "em revisão",
  resolved: "resolvido",
  closed: "fechado",
};

/** Palavra humana para o portal público — nunca o vocabulário interno. */
export const STATUS_LABEL_PUBLIC: Record<string, string> = {
  open: "Recebido",
  in_analysis: "Em análise",
  waiting_author: "Aguardando você",
  in_review: "Em análise",
  resolved: "Resolvido",
  closed: "Encerrado",
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: "baixa",
  normal: "normal",
  high: "alta",
  urgent: "urgente",
};

export const ORIGIN_LABEL: Record<string, string> = {
  portal: "portal",
  whatsapp: "whatsapp",
  internal: "interno",
};
