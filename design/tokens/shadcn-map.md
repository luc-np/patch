# Mapa shadcn/ui — o que usar, o que sobrescrever

Instale só o que está aqui. Todo componente do shadcn entra **com `--radius: 0rem`**, sem sombra (exceto Dialog/Popover/DropdownMenu) e sem cor própria.

| Parte da UI | Primitiva | Sobrescrever |
| --- | --- | --- |
| Fila (tabela densa) | `Table` do shadcn **ou** grid de `div` com `role="table"/"row"/"cell"` | `TableCell` para `px-3 py-0 h-[var(--row-h)]`, `TableHead` para mono 10px uppercase + `border-b-2 border-rule`; linha selecionada `bg-row-sel`, hover `bg-row-hover`. Se a lista passar de ~200 linhas, use TanStack Virtual em vez de paginar. |
| Filtros da toolbar | `Popover` + `Command` | Trigger de 24–26px com rótulo em mono 11px, borda 1px, sem chevron decorativo. |
| Origem (portal/whatsapp/interno) | `ToggleGroup` `type="multiple"` | Ativo = `bg-primary text-primary-foreground`; grupo com divisor de 1px, sem gap. |
| Busca `/` + paleta de comandos | `Command` (cmdk) em `Dialog` | Radius 0, mono nos caminhos, sombra `--shadow-lg`. |
| Abas do compositor | `Tabs` | Sem pílula: aba ativa = `bg-primary text-primary-foreground` em mono 11.5px; a aba troca placeholder, fundo do campo e rótulo do botão. |
| Campos | `Textarea`, `Input`, `Select`, `Label` | App interno 13.5px / altura 28–32px. Portal público 15px / altura 42–50px. `caret-color: var(--ai)`. |
| Botões | `Button` | Variantes: `default` = tinta (`bg-primary`), `outline` = borda 1px, `ghost` = sem borda, **e uma variante nova `ai`** = `bg-ai text-ai-foreground hover:bg-ai-strong`, usada só na ação primária da sugestão. Sempre `justify-start whitespace-nowrap min-h-*` (nunca `h-*` fixo com texto que pode quebrar). |
| Chips de expertise | `Badge` | Duas variantes: `declared` = `border border-foreground`; `inferred` = `border border-dashed border-muted-foreground text-muted-foreground` + prova em mono 10px. `whitespace-nowrap`, a **fileira** quebra, o chip não. |
| Skeleton | `Skeleton` | `rounded-none`, e replique a **mesma grade** da tabela final. Desligue o pulse sob `prefers-reduced-motion`. |
| Caminho truncado | `Tooltip` | Ou apenas `title` no elemento; caminho em mono 12px com `truncate`. |
| Confirmações | `Dialog` / `AlertDialog` | Único lugar com sombra (`--shadow-lg`). Título Archivo 800 20px, ações à direita. |
| Avisos de ação | `Sonner` | Mono 11.5px, radius 0, sem ícone colorido. |
| Tema | `next-themes` | `attribute="class"`, `defaultTheme="system"`, atalho `t`, rótulo no header: `tema: sistema/claro/escuro`. |
| Atalhos | handler próprio ou `react-hotkeys-hook` | Ignore quando o foco está em `input`/`textarea`/`select`. |

## Não use

`Card` na fila, no chamado ou no projeto (a régua faz o trabalho — `Card` só se algum dia houver um dashboard de leitura), `Progress` para confiança (a espinha de 5 segmentos é desenhada com `div`s de 9px), `Badge` colorido para status, `Accordion` para evidência (é um `<button>` que expande a `<div>` do trecho), `Avatar` com foto (inicial em mono dentro de caixa de 1px), qualquer ícone flutuante. Ícones: Lucide, 14–16px, sempre acompanhados de rótulo.

## Componentes próprios que valem existir

- `<AiSuggestion suggestion={...} />` — recebe `{ person, confidence, rationale, evidence[], model, indexedAt }` e decide sozinho entre os três estados por faixa de confiança (`>= .70` alta · `.55–.70` alta sem ostentação · `< .55` baixa · `null` ausente).
- `<ConfidenceSpine value={0.86} />` — número tabular + 5 segmentos.
- `<EvidenceRow path lines meta expandable />` — grid `minmax(0,1fr) auto`, caminho com truncate e `title`.
- `<CodeExcerpt from={118} lines={[...]} />` — uma `div white-space:pre` por linha; número em `--muted-foreground`, trecho citado em `--ai-strong`.
- `<QueueRow />` e `<QueueHeader />` — uma constante única para `grid-template-columns`, importada pelos dois (e pelo skeleton).
- `<OriginBadge origin="whatsapp" />` — mono minúsculo, sem cor.
- `<DataOrigin kind="declared" | "inferred" />` — o chip que mostra de onde vem o dado.
