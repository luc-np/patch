"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useShortcuts } from "@/hooks/use-shortcuts";
import {
  formatTicketRef,
  formatDateTime,
  formatTime,
  STATUS_LABEL,
  PRIORITY_LABEL,
  ORIGIN_LABEL,
} from "@/lib/format";
import type { TicketDetail } from "@/services/tickets";
import type { MessageItem } from "@/services/messages";
import type { MemberItem, ActivityItem } from "@/services/members";
import { sendReply, assign, setStatus } from "@/app/(app)/tickets/[ref]/actions";

const ACTIVITY_LABEL: Record<string, string> = {
  "ticket.create": "chamado aberto",
  "ticket.reply": "resposta enviada",
  "ticket.note": "nota interna",
  "ticket.assign": "responsável definido",
  "ticket.unassign": "responsável removido",
  "ticket.status": "estado alterado",
  "suggestion.created": "Patch sugeriu",
  "suggestion.accepted": "sugestão aceita",
  "suggestion.rejected": "sugestão recusada",
};

export type WaWindow = { open: boolean; closesAt: string | null } | null;

export function TicketScreen({
  ticket,
  messages,
  members,
  activity,
  aiSlot,
  codeSlot,
  waWindow = null,
}: {
  ticket: TicketDetail;
  messages: MessageItem[];
  members: MemberItem[];
  activity: ActivityItem[];
  /** bloco de sugestão da IA — entra na etapa de triagem */
  aiSlot?: React.ReactNode;
  /** bloco `código` do rail direito (proposta de PR em .md) */
  codeSlot?: React.ReactNode;
  waWindow?: WaWindow;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"autor" | "interna">("autor");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const firstName = ticket.authorName.split(" ")[0] ?? ticket.authorName;

  const shortcuts = useMemo(
    () => ({
      esc: () => router.push("/"),
      i: () => {
        setTab("interna");
        textareaRef.current?.focus();
      },
    }),
    [router],
  );
  useShortcuts(shortcuts);

  function submit() {
    if (!body.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await sendReply({
        ticketId: ticket.id,
        body: body.trim(),
        internal: tab === "interna",
      });
      if (!res.ok) setError(res.error ?? "Não deu para enviar agora.");
      else setBody("");
    });
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* Coluna central */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
          <Link
            href="/"
            className="text-[13px] text-muted-foreground hover:text-foreground"
          >
            ← fila
          </Link>
          <span className="font-mono text-[11px] text-muted-foreground tnum">
            {formatTicketRef(ticket.number)}
          </span>
          <h1 className="truncate text-[14px] font-semibold" title={ticket.title}>
            {ticket.title}
          </h1>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          {aiSlot}

          {/* Conversa */}
          <section className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <span className="kicker">conversa</span>
              <span className="h-0 flex-1 border-t border-border" aria-hidden />
              <span className="font-mono text-[10.5px] text-muted-foreground tnum">
                {messages.length + 1}
              </span>
            </div>

            {/* Corpo original do chamado */}
            <article className="mt-4 max-w-[68ch]">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold">{ticket.authorName}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {ORIGIN_LABEL[ticket.origin]} · {formatDateTime(new Date(ticket.createdAt))}
                </span>
              </div>
              <p className="mt-1.5 text-[14px] whitespace-pre-wrap">{ticket.body}</p>
            </article>

            {messages.map((m) =>
              m.internal ? (
                <article
                  key={m.id}
                  className="mt-5 border-t-2 border-rule border-b border-b-border bg-card px-4 py-3"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] tracking-[0.1em] uppercase">
                      nota interna
                    </span>
                    <span className="text-[13px] font-semibold">{m.authorName}</span>
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {formatDateTime(new Date(m.createdAt))}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {ticket.origin === "internal" ? "o autor não vê isto" : "a autora não vê isto"}
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-[68ch] text-[14px] whitespace-pre-wrap">
                    {m.body}
                  </p>
                </article>
              ) : (
                <article key={m.id} className="mt-5 max-w-[68ch]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold">{m.authorName}</span>
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {formatDateTime(new Date(m.createdAt))}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[14px] whitespace-pre-wrap">{m.body}</p>
                </article>
              ),
            )}
          </section>
        </div>

        {/* Compositor sticky */}
        <div className="shrink-0 border-t-2 border-rule">
          <div className="flex">
            {(
              [
                ["autor", `resposta ${ticket.origin === "internal" ? "ao autor" : "à autora"}`],
                ["interna", "nota interna"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTab(value);
                  textareaRef.current?.focus();
                }}
                className={cn(
                  "h-7 px-3 font-mono text-[11.5px]",
                  tab === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-row-hover",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={cn("p-3", tab === "interna" ? "bg-card" : "bg-background")}>
            <textarea
              ref={textareaRef}
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              placeholder={
                tab === "autor"
                  ? `Escreva a resposta para ${firstName}…`
                  : "Contexto para o time — decisões, hipóteses, próximos passos…"
              }
              className={cn(
                "w-full resize-y border border-input px-3 py-2 text-[13.5px]",
                tab === "interna" ? "bg-card" : "bg-background",
              )}
              style={{ caretColor: "var(--ai)" }}
            />
            {error && <p className="mt-1 text-[12.5px] text-ai-strong">{error}</p>}
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={pending || !body.trim()}
                className="flex h-8 items-center bg-primary px-3 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
              >
                {tab === "autor" ? `Responder a ${firstName}` : "Salvar nota interna"}
              </button>
              <span className="font-mono text-[10.5px] text-muted-foreground">
                {tab === "interna"
                  ? `não vai para ${ticket.origin === "internal" ? "o autor" : "a autora"} · fica no histórico do chamado`
                  : ticket.origin === "whatsapp"
                    ? waWindow?.open
                      ? "sai por whatsapp · quem abriu recebe agora"
                      : "janela de 24h fechada · sai só quando a pessoa escrever de novo"
                    : "sai por e-mail · quem abriu recebe agora"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rail direito */}
      <aside className="w-[268px] shrink-0 overflow-auto border-l-2 border-rule">
        <section className="p-4">
          <p className="kicker mb-2">metadados</p>
          <dl className="grid grid-cols-[78px_1fr] gap-y-1.5 text-[12.5px]">
            <dt className="text-muted-foreground">projeto</dt>
            <dd className="font-mono text-[11.5px]">{ticket.projectSlug}</dd>
            <dt className="text-muted-foreground">origem</dt>
            <dd className="font-mono text-[11.5px]">
              {ORIGIN_LABEL[ticket.origin]}
              {ticket.origin === "whatsapp" && ticket.externalRef
                ? ` · ${maskPhone(ticket.externalRef)}`
                : ""}
            </dd>
            {waWindow && (
              <>
                <dt className="text-muted-foreground">janela 24h</dt>
                <dd className="font-mono text-[11.5px]">
                  {waWindow.open && waWindow.closesAt ? (
                    <WindowCountdown closesAt={waWindow.closesAt} />
                  ) : (
                    <span className="text-ai-strong">fechada</span>
                  )}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">
              {ticket.origin === "internal" ? "autor" : "autora"}
            </dt>
            <dd>
              {ticket.authorName}
              <span className="ml-1 font-mono text-[10.5px] text-muted-foreground tnum">
                · {ticket.authorTicketCount}º chamado
              </span>
            </dd>
            <dt className="text-muted-foreground">aberto</dt>
            <dd className="font-mono text-[11.5px]">
              {formatDateTime(new Date(ticket.createdAt))}
            </dd>
            <dt className="text-muted-foreground">1ª resposta</dt>
            <dd className="font-mono text-[11.5px]">
              {ticket.firstResponseAt
                ? formatDateTime(new Date(ticket.firstResponseAt))
                : "ainda não"}
            </dd>
            <dt className="text-muted-foreground">estado</dt>
            <dd>
              <select
                value={ticket.status}
                onChange={(e) =>
                  void setStatus({
                    ticketId: ticket.id,
                    status: e.target.value as Parameters<typeof setStatus>[0]["status"],
                    ticketNumber: ticket.number,
                  }).then(() => router.refresh())
                }
                className="w-full border border-input bg-background px-1 py-0.5 font-mono text-[11.5px] lowercase"
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </dd>
            <dt className="text-muted-foreground">prioridade</dt>
            <dd className="font-mono text-[11.5px] lowercase">
              {PRIORITY_LABEL[ticket.priority]}
            </dd>
            <dt className="text-muted-foreground">responsável</dt>
            <dd>
              <select
                value={ticket.assigneeId ?? ""}
                onChange={(e) =>
                  void assign({
                    ticketId: ticket.id,
                    assigneeId: e.target.value || null,
                    ticketNumber: ticket.number,
                  }).then(() => router.refresh())
                }
                className="w-full border border-input bg-background px-1 py-0.5 text-[12px]"
              >
                <option value="">sem responsável</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </dd>
          </dl>
        </section>

        {codeSlot}

        <section className="border-t border-border p-4">
          <p className="kicker mb-2">atividade</p>
          <ol className="space-y-1.5 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
            {activity.length === 0 && <li>—</li>}
            {activity.map((a) => (
              <li key={a.id}>
                {formatTime(new Date(a.createdAt))} ·{" "}
                {a.actorKind === "ai" ? (
                  <span className="text-ai-strong">
                    {ACTIVITY_LABEL[a.action] ?? a.action}
                  </span>
                ) : (
                  <>
                    {ACTIVITY_LABEL[a.action] ?? a.action}
                    {a.actorName ? ` · ${a.actorName.split(" ")[0]}` : ""}
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}

function WindowCountdown({ closesAt }: { closesAt: string }) {
  const remainingMs = new Date(closesAt).getTime() - Date.now();
  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  const label = hours > 0 ? `${hours}h${String(minutes).padStart(2, "0")}` : `${minutes}min`;
  // Menos de 4h para fechar merece destaque — depois disso só resta template aprovado.
  return (
    <span className={hours < 4 ? "text-ai-strong" : undefined}>
      fecha em {label}
    </span>
  );
}

function maskPhone(ref: string): string {
  const digits = ref.replace(/\D/g, "");
  if (digits.length < 6) return "•••";
  return `+${digits.slice(0, 4)} ••••-${digits.slice(-4)}`;
}
