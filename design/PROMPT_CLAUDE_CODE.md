# Prompt de design — Patch (colar junto com o prompt de produto)

Você vai implementar a interface do **Patch** em React + Tailwind + shadcn/ui. Este documento é a **fonte de verdade visual**. O prompt de produto define o que o sistema faz; este define como ele parece, se comporta e fala. Onde os dois divergirem em matéria de aparência, este vence.

## Arquivos deste pacote

| Arquivo | Para quê |
| --- | --- |
| `tokens/globals.css` | Copie para `src/app/globals.css` (ou `src/index.css`). Tokens de tema em CSS vars, claro + escuro, no formato que o shadcn espera. É o único lugar onde cor existe. |
| `tokens/shadcn-map.md` | Quais primitivas do shadcn usar em cada parte da UI e o que sobrescrever. Leia antes de gerar componente. |
| `reference/Patch.dc.html` | Protótipo de referência: abra no navegador e navegue pelas 6 telas. É **referência de design, não código de produção** — não copie o HTML, recrie em React. |
| `README.md` | Especificação tela por tela, com medidas, textos e estados. |

Ordem de trabalho sugerida: `globals.css` → shell (header + rail + frame de rolagem) → Fila → Chamado (bloco de IA por último, é o mais caro) → Projeto → Equipe → Portal.

## Identidade em uma linha

Bancada de trabalho modernista: tudo em Archivo, régua e alinhamento no lugar de sombra e cartão, raio zero em qualquer canto, uma mono como conteúdo de primeira classe — e um único vermelho, reservado à camada de IA.

## Regras invioláveis

1. **Raio zero em tudo.** `--radius: 0rem`. Nenhum `rounded-*` no código, exceto avatares circulares e o `.dot` de radio.
2. **Sem sombra**, exceto em `Dialog`/`Popover`/`DropdownMenu` (aí use `--shadow-lg`). Nada de cartão com sombra difusa.
3. **Hierarquia por régua**, não por caixa: `1px` (`--border`) entre linhas iguais, `2px` (`--rule`) entre seções. Não afine a régua de 2px para hairline.
4. **O vermelho é da IA.** `--ai` (#ec3013 claro / #ff563c escuro) só aparece na camada de sugestão e na ação primária dela. Nenhum outro elemento usa vermelho como campo. Texto vermelho em tamanho de corpo usa `--ai-strong` (#ae1800 / #ff9783), nunca o `--ai` puro (contraste).
5. **Zero semáforo.** Não existe verde nem amarelo no produto. Estado se lê em palavra e posição (`aberto`, `em análise`, `aguardando autor`), não em cor.
6. **Duas densidades, de propósito.** App interno: base 13px, linha de fila 36px, padding de célula 12px. Portal público: base 15–16px, respiro 24–32px, título 25–32px. Mesmos tokens, densidade metade.
7. **A mono é conteúdo.** IBM Plex Mono para caminho de arquivo, branch, commit, id de chamado, horário, contagem e confiança. Nunca para frase corrida. `font-variant-numeric: tabular-nums` em qualquer número que alinhe em coluna.
8. **Tudo alinhado à esquerda**, inclusive rótulo dentro de botão largo (`justify-start`). Não centralize título nem CTA.
9. **Claro e escuro são iguais em prioridade.** `next-themes` com `defaultTheme="system"`, estratégia `class`, e um alternador no header (atalho `t`). Nenhum valor de cor fora de `globals.css`.
10. **Foco visível sempre:** `outline: 2px solid var(--ring); outline-offset: 2px`. Nunca `outline: none` sem substituto. Respeite `prefers-reduced-motion` em qualquer skeleton ou transição.

## Tipografia

| Papel | Família | Uso | Tamanhos |
| --- | --- | --- | --- |
| Display | Archivo 800 | nome sugerido pela IA, títulos de tela, h1/h2 do portal | 40 / 32 / 30 / 26 / 22 |
| Texto | Archivo 400/500/600 | interface, conversa, formulário | 16 / 15 / 14 / 13.5 / 13 / 12.5 |
| Dados | IBM Plex Mono 400/500 | caminho, branch, id, hora, contagem, confiança | 12 / 11.5 / 11 / 10.5 / 10 |

Rótulo de seção = mono 10px, `letter-spacing: 0.1em`, `uppercase`, cor `--muted-foreground`. `letter-spacing: -0.02em` em display acima de 22px. Nada abaixo de 10px.

Carregue as duas famílias por `next/font` (ou `<link>` do Google Fonts): `Archivo` 400,500,600,800 e `IBM_Plex_Mono` 400,500.

## Densidade e grid

- Linha de fila: **36px** (`--row-h`, prop de densidade opcional: 36 / 32 / 28).
- Colunas da fila, nesta ordem: `26px` marca de IA · `86px` id · `minmax(0,1fr)` título · `104px` projeto · `96px` origem · `176px` responsável · `132px` estado · `78px` atualizado (alinhado à direita).
- **Toda trilha de conteúdo em grid precisa de piso real ou zero-floor consciente**: `minmax(0,1fr)` quando o texto pode elidir (com `truncate` + `title`), `minmax(<piso>,1fr)` quando não pode desaparecer. Trilha de metadado que pode encolher vai como `auto`. Isso não é detalhe: foi a origem de metade dos bugs de layout no protótipo.
- **Frase nunca é flex container.** Texto com `<span>` mono no meio vai em um único nó (ou grid de 2 células `24px 1fr`), senão cada trecho quebra por conta própria.
- Shell: raiz `h-screen overflow-hidden flex flex-col`; cada painel rola por dentro (`flex-1 min-h-0 overflow-auto`). Header (46px), rail (214px) e barra de atalhos (28px) nunca rolam.

## Atalhos de teclado (obrigatórios)

`j`/`k` ou setas movem a seleção na fila · `enter` abre · `a` aceita a sugestão da IA · `i` foca o compositor em nota interna · `/` foca a busca · `t` alterna tema · `esc` volta para a fila. Ignore o atalho quando o foco estiver em `input`, `textarea` ou `select`. A barra inferior lista os atalhos em mono 10.5px com a tecla em caixa de 1px.

## O bloco de sugestão da IA

É o coração do produto e o único lugar onde há ousadia. Fica no **topo da coluna central** da tela de chamado, largura total, acima da conversa. Três estados, e a diferença entre eles é **quantidade de tinta e de evidência**, não cor de semáforo.

Estrutura comum: coluna esquerda de 88px (medida de confiança) + corpo (quem, por quê, evidência, ações).

**Confiança alta (≥ 0.70)**
- Moldura `2px solid var(--ai)`, fundo `var(--ai-tint)`.
- Espinha: número em mono 26px 600 (`0.86`, tabular) + 5 segmentos de 9px empilhados de baixo para cima, preenchidos proporcionalmente em `--ai` (o parcial em `opacity: .3`), legenda mono 9.5px `4 de 5 medidas`.
- Rótulo mono 10px uppercase `Patch sugere` + procedência (`modelo triage-3 · 1.2s · índice de 09:12`).
- Nome em **Archivo 800, 30px**, com a especialidade em mono 11px ao lado.
- Justificativa: 1–2 frases, 14.5px, máx. 62ch, citando número verificável ("9 dos 11 commits").
- **Evidência ocupa a maior parte do bloco**, separada por régua de 2px em `--ai`: 4 linhas em grid `minmax(0,1fr) auto` — caminho em mono 12px (truncate + `title`), contagem em mono 10.5px na segunda linha, faixa de linhas (`L118–164`) à direita em tabular. A primeira linha é um `<button>` que expande um trecho de código real: uma `<div white-space: pre>` por linha, número da linha em `--muted-foreground`, o comentário citado em `--ai-strong`.
- Ações: primária `Aceitar e atribuir a Marina` (fundo `--ai`, com a tecla `a` em mono 10px à direita do rótulo) · `Escolher outra pessoa` (outline) · `Ignorar sugestão` (ghost) · à direita, em mono 10.5px: `sugestão, não decisão · nada é atribuído sem você`.
- Aceitar substitui o bloco por uma barra de 1px: `atribuído · Marina Alencar · sugestão aceita · hoje 09:15 · por você` + `Desfazer`.

**Confiança baixa (< 0.55)** — mesma estrutura, **sem nenhum vermelho**:
- Moldura 1px `--border`, fundo `--card`, espinha em `--muted-foreground` com 1,5 de 5 segmentos (os vazios só com borda), número em mono 20px 500.
- Rótulo muda para `Patch arrisca um palpite`; o nome volta a **corpo 16px 600** (a hierarquia cai junto com a confiança).
- Justificativa admite o problema ("mas o erro 500 vem de um trecho que ninguém do time toca desde março. Leia a evidência antes de aceitar.").
- Evidência com 2 arquivos e rótulo `evidência rala`.
- Inversão de ação: primária passa a ser `Escolher responsável` (outline em `--foreground`); aceitar vira secundário `Atribuir a Diego mesmo assim`.

**Sem sugestão** — precisa parecer resposta honesta, não falha:
- Caixa 1px, sem espinha, sem vermelho, sem ícone de alerta.
- Rótulo `Patch não sugere ninguém` + frase em primeira pessoa, Archivo 600 17px: "Não encontrei evidência suficiente para sugerir alguém. Prefiro dizer isso a chutar um nome."
- Um parágrafo explicando **por quê**, com o caminho em mono ("o arquivo entrou pela migração de março sem histórico").
- Seção `o que me deixaria útil aqui`: 2 itens numerados em mono, cada um uma ação concreta (reindexar tal repo; declarar dono de tal pasta).
- Seção `atribuir à mão` em primeiro plano: 4 pessoas como botões de 30px com a área em mono 10.5px, mais `Reindexar agora`.
- Nunca use as palavras "erro", "falha" ou "não foi possível" neste estado.

## Microcopy

Português do Brasil, voz ativa, sentence case, sem jargão interno no portal. **O botão diz o que acontece:** `Aceitar e atribuir a Marina`, `Salvar nota interna`, `Responder a Camila`, `Abrir chamado`, `Reindexar repositório`, `Tentar carregar de novo`. Proibido: `Enviar`, `OK`, `Confirmar`, `Salvar` sozinho.

Fila vazia é boa notícia: "Fila limpa." + "Nenhum chamado aberto em checkout. Os 3 que entraram hoje já foram resolvidos — o último por Nina, às 09:04." Nada de ilustração ou "nenhum resultado encontrado".

Erro é honesto e específico, com o que aconteceu, quando, e o que não foi perdido — mais o request em `<pre>` mono (`GET /api/queue?project=checkout → 503 service_unavailable · req_id 8f2c1a04 · 09:14:22`) e duas saídas (`Tentar carregar de novo`, `Ver status dos serviços`).

Carregando: skeleton com a **mesma grade** da tabela final (não bloco genérico), `animate-pulse` desligado sob `prefers-reduced-motion`, mais uma linha em mono: `carregando 12 chamados de checkout…`.

## Telas

1. **Fila de trabalho** — rail 214px (busca com dica `/`, visões com contagem, projetos em mono, rodapé com estado do índice) + toolbar de filtros (projeto, status, responsável, origem como toggles portal/whatsapp/interno) + tabela densa + barra de atalhos fixa. Marca de IA na primeira coluna: `◆` em `--ai` quando há sugestão pendente, `·` em `--muted-foreground` quando não. Responsável sem dono mostra `sugerido: Marina` em `--ai-strong`; sem sugestão, `sem responsável` em `--muted-foreground`. Linha selecionada: fundo `--row-sel` + título 600.
2. **Chamado aberto** — coluna central (bloco de IA → conversa → compositor sticky) + rail direito de 268px (metadados em grid `78px 1fr`, bloco `código` com branch sugerida e `Criar branch e abrir PR`, atividade em mono). **Nota interna é visualmente outra coisa:** fundo `--card`, régua de 2px no topo, rótulo mono `nota interna` e a linha `a autora não vê isto`. Compositor com duas abas (`resposta à autora` / `nota interna`); a aba troca fundo, placeholder, rótulo do botão e a dica ("sai por whatsapp e por e-mail · a autora recebe agora" vs. "não vai para a autora · fica no histórico do chamado").
3. **Projeto** — cabeçalho com repo em mono + `Reindexar repositório`; quatro números em mono 22px em células iguais divididas por 1px (chamados abertos, 1ª resposta mediana, sugestões aceitas `17/25`, vence hoje) — **sem seta, sem variação percentual, sem verde**; abaixo, grid `minmax(0,1fr) 320px`: lista de chamados à esquerda, à direita repositório conectado + estado da última indexação + pastas sem dono declarado + notas de contexto (com a observação `lidas pela IA`).
4. **Equipe e expertise** — grid `200px minmax(0,1fr) minmax(0,1fr) 120px`. **Origem do dado é visível:** área declarada = chip de borda sólida `1px --foreground`; área inferida do git = chip de **borda tracejada** `--muted-foreground` com a prova ao lado (`41 commits`, `sinal fraco`). Legenda no cabeçalho explicando as duas. Rodapé: "área declarada pesa mais que inferida na sugestão — e a inferida nunca vira declarada sozinha".
5. **Portal público `/support/[projeto]`** — uma coluna, calma, responsiva (mobile 390 e desktop lado a lado no protótipo). Marca do projeto = quadrado de 12px na cor do projeto + nome + `suporte`. Variação por projeto é só **nome e cor** (`--project-accent`, com fallback `--ai`), aplicada ao quadrado e ao botão. Campos com altura 42–50px, rótulo 14px 600, dica 12.5px. Botão `Abrir chamado` com rótulo à esquerda. Abaixo, `Seus chamados` com status em palavra humana (`Em análise`, `Resolvido`) — nunca o vocabulário interno.
6. **Tokens** — página de referência: 6 papéis de cor com hex e justificativa, escala tipográfica em tamanho real, escala de espaço e as duas réguas. Mantenha no app como rota interna `/design`; é o que impede a paleta de derivar.

## Anti-padrões (rejeite mesmo se o gerador sugerir)

Gradiente; cartão com sombra difusa; número grande com seta verde; badge colorido de status; ícone flutuante; roxo; borda esquerda colorida como decoração; emoji; ilustração de estado vazio; `Enviar`; canto arredondado; `text-center` em título; skeleton genérico que não respeita a grade final; qualquer hex escrito fora de `globals.css`.

## Pronto quando

- [ ] Nenhum hex, nenhuma família de fonte e nenhum `rounded-*` fora de `globals.css`.
- [ ] Claro e escuro conferidos nas 6 telas, incluindo o bloco de IA nos 3 estados.
- [ ] `j k enter a i / t esc` funcionam e a barra de atalhos diz a verdade.
- [ ] A fila rola por dentro: header, rail e barra de atalhos ficam parados com 200 linhas na tabela.
- [ ] Em 924px de largura nenhuma célula invade a coluna vizinha e nenhum texto escapa da borda do botão ou do chip.
- [ ] O trecho de código do bloco de IA quebra em linhas exatas e numeradas.
- [ ] Sem sugestão não parece erro; confiança baixa não tem vermelho.
- [ ] Foco visível em todo controle; `prefers-reduced-motion` desliga o pulse.
- [ ] Nenhum verde, nenhum amarelo, nenhum vermelho fora da camada de IA.
