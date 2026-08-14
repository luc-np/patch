import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";

/**
 * /design — referência viva dos tokens. É o que impede a paleta de derivar.
 * Rota interna: mostra os 6 papéis de cor, a tipografia em tamanho real,
 * a escala de espaço e as duas réguas.
 */

const COLORS: { name: string; varName: string; light: string; dark: string; why: string }[] = [
  { name: "papel (ground)", varName: "--background", light: "#f3f2f2", dark: "#191817", why: "ground do Modernist; no escuro desce abaixo do neutro-900 para o texto não vibrar" },
  { name: "superfície", varName: "--card", light: "#eae9e9", dark: "#211f1e", why: "separa nota interna, código e painel sem sombra" },
  { name: "tinta", varName: "--foreground", light: "#201e1d", dark: "#f3f2f2", why: "texto e réguas; a hierarquia vem da régua, não da cor" },
  { name: "grafite", varName: "--muted-foreground", light: "#605d5d", dark: "#b3afae", why: "id, hora, caminho: um só neutro médio para os dois temas" },
  { name: "rubro (IA)", varName: "--ai", light: "#ec3013", dark: "#ff563c", why: "exclusivo da camada de IA e da ação primária dela" },
  { name: "rubro fundo", varName: "--ai-strong", light: "#ae1800", dark: "#ff9783", why: "rubro em tamanho de corpo, onde o accent puro não passa contraste" },
];

const TYPE_SCALE = [
  { label: "display 26", className: "text-[26px] font-extrabold tracking-tight", sample: "Fila limpa." },
  { label: "display 22", className: "text-[22px] font-extrabold tracking-tight", sample: "Checkout" },
  { label: "texto 14", className: "text-[14px]", sample: "O corpo da conversa usa Archivo em 14px, máx. 68ch." },
  { label: "texto 13", className: "text-[13px]", sample: "A interface densa do app interno vive em 13px." },
  { label: "mono 12", className: "font-mono text-[12px]", sample: "services/whatsapp.ts · L118–164" },
  { label: "mono 10.5", className: "font-mono text-[10.5px]", sample: "sai por whatsapp e por e-mail · a autora recebe agora" },
];

const SPACE_SCALE = [4, 8, 12, 16, 24, 32];

export default async function DesignPage() {
  const actor = await getActor();
  if (!actor || actor.role === "guest") redirect("/login");

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="max-w-[760px] px-6 py-8">
        <h1 className="text-[26px]">Tokens</h1>
        <p className="mt-2 max-w-[56ch] text-[13.5px] text-muted-foreground">
          A referência viva do sistema. Toda cor mora em{" "}
          <span className="font-mono text-[11.5px]">app/globals.css</span> — se
          um hex aparecer em outro lugar, é bug.
        </p>

        <section className="mt-8">
          <p className="kicker mb-2">papéis de cor</p>
          <div className="border-t-2 border-rule">
            {COLORS.map((c) => (
              <div
                key={c.varName}
                className="grid grid-cols-[24px_150px_110px_130px_1fr] items-center gap-3 border-b border-border py-2"
              >
                <span
                  className="inline-block size-5 border border-border"
                  style={{ background: `var(${c.varName})` }}
                />
                <span className="text-[13px] font-semibold">{c.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {c.light}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  escuro {c.dark}
                </span>
                <span className="text-[12px] text-muted-foreground">{c.why}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <p className="kicker mb-2">tipografia — em tamanho real</p>
          <div className="border-t-2 border-rule">
            {TYPE_SCALE.map((t) => (
              <div
                key={t.label}
                className="grid grid-cols-[110px_1fr] items-baseline gap-4 border-b border-border py-2.5"
              >
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {t.label}
                </span>
                <span className={t.className}>{t.sample}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <p className="kicker mb-2">escala de espaço</p>
          <div className="flex items-end gap-4 border-t-2 border-rule pt-3">
            {SPACE_SCALE.map((s) => (
              <div key={s} className="flex flex-col items-start gap-1">
                <span
                  className="inline-block bg-foreground"
                  style={{ width: s, height: s }}
                />
                <span className="font-mono text-[10px] text-muted-foreground tnum">
                  {s}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <p className="kicker mb-2">as duas réguas</p>
          <div className="border-t-2 border-rule pt-3">
            <div className="border-b border-border pb-2 text-[13px]">
              1px entre linhas iguais —{" "}
              <span className="font-mono text-[11px] text-muted-foreground">
                color-mix(tinta 20%)
              </span>
            </div>
            <div className="border-b-2 border-rule py-2 text-[13px]">
              2px entre seções —{" "}
              <span className="font-mono text-[11px] text-muted-foreground">
                color-mix(tinta 40%)
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <p className="kicker mb-2">regras</p>
          <ul className="space-y-1 border-t-2 border-rule pt-3 text-[13px]">
            <li>· nenhum verde, nenhum amarelo — estado se lê em palavra e posição</li>
            <li>· o vermelho é da IA; nenhum outro elemento o usa como campo</li>
            <li>· linha de fila 36px (densa 32, compacta 28)</li>
            <li>· raio 0 em tudo; sombra só em Dialog/Popover</li>
            <li>· número que alinha em coluna é sempre tabular</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
