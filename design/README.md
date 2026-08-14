# Handoff: Patch — suporte e tasks com triagem por IA

## Visão geral

Ferramenta interna para um time de 5 a 10 pessoas (devs, um CS, um PO) receber chamados de três origens (portal público, WhatsApp, interno) e decidir quem atende, com uma camada de IA que **sugere** responsável a partir do histórico do repositório. Dois públicos com necessidades opostas: o time vive na ferramenta e precisa de densidade e atalhos; o autor externo entra uma vez, possivelmente irritado, e precisa de uma tela calma.

## Sobre os arquivos deste pacote

`reference/Patch.dc.html` é uma **referência de design feita em HTML** — um protótipo que mostra aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é **recriar estas telas no ambiente do projeto** (React + Tailwind + shadcn/ui), com os padrões e bibliotecas dele. Abra o arquivo no navegador e navegue: as 6 telas estão na barra de navegação do topo; os estados vazio/carregando/erro ficam no seletor "estado da tela"; os três estados do bloco de IA ficam no seletor "bloco de ia" no cabeçalho do chamado; `t` alterna claro/escuro.

Comece por `PROMPT_CLAUDE_CODE.md` (é o prompt de design, feito para colar junto com o prompt de produto) e copie `tokens/globals.css` para o projeto.

## Fidelidade

**Alta (hi-fi).** Cores, tipografia, espaçamento, densidade e microcopy são finais e devem ser reproduzidos com precisão, usando as primitivas do shadcn. O que é deliberadamente ilustrativo: os dados (chamados, pessoas, caminhos de arquivo, commits) e o número de itens em cada lista.

## Design system

O projeto está preso ao design system **Modernist**: tudo em Archivo, ground #f3f2f2 com tinta #201e1d, um único accent #ec3013, raio 0, réguas de 2px, nada flutua, tudo alinhado à esquerda. Duas adaptações feitas de propósito e que devem ser mantidas:

1. **Tema escuro** (o Modernist é só claro): ground #191817, tinta #f3f2f2, accent sobe para #ff563c (o #ec3013 não passa contraste sobre escuro).
2. **Uma família mono** — IBM Plex Mono. O Modernist não traz mono; aqui caminho de arquivo, branch, id e confiança são conteúdo, e a mono é identidade, não detalhe técnico.

O accent do sistema ficou **reservado à camada de IA**. Nenhum outro elemento usa vermelho como campo; não existe verde nem amarelo no produto.

## Telas

### 1. Fila de trabalho
**Objetivo:** ficar aberta o dia inteiro; entender o estado de tudo em uma olhada e agir sem navegar.
**Layout:** header 46px (`border-bottom: 2px`) · rail esquerdo 214px (`border-right: 2px`) · conteúdo `flex-1` · barra de atalhos 28px no rodapé. A raiz é `height: 100vh; overflow: hidden`; só o corpo da tabela rola.
- **Rail:** campo de busca 28px com dica `/` · seção `visões` (Minha fila 7, Sem responsável 4, Sugestão pendente 5 em `--ai-strong`, Vence hoje 2) · seção `projetos` em mono (checkout 12, faturamento 5, portal-web 3) · rodapé com `índice checkout / 14/08 09:12 · 1.284 arq.` em mono 10px. Item ativo: `bg-row-sel`, 500. Altura de item 27px.
- **Toolbar:** título "Minha fila" (Archivo 800 15px) + contagem em mono 11px + filtros (projeto, status, responsável) como caixas de 1px com rótulo mono 11px + toggles de origem (portal/whatsapp/interno, ativo = tinta cheia) + à direita o seletor de estado da tela.
- **Tabela:** cabeçalho 28px sticky, mono 10px uppercase, `border-bottom: 2px`. Linhas de 36px, `border-bottom: 1px`, hover `--row-hover`, selecionada `--row-sel` + título 600. Colunas: `26px 86px minmax(0,1fr) 104px 96px 176px 132px 78px` = ia · id · título · projeto · origem · responsável · estado · atualizado (à direita).
  - Marca de IA: `◆` em `--ai` quando há sugestão pendente; `·` em `--muted-foreground` quando não.
  - Responsável: nome em `--foreground`; sem dono com sugestão = `sugerido: Marina` em `--ai-strong`; sem nada = `sem responsável` em `--muted-foreground`.
  - Estado em mono minúsculo (`aberto`, `em análise`, `aguardando autor`, `em revisão`) — sem badge, sem cor.
  - `vence hoje` na última coluna em `--ai-strong`; demais tempos em `--muted-foreground`.
- **Barra de atalhos:** mono 10.5px, cada tecla em caixa de 1px: `j k mover · enter abrir · a aceitar sugestão · i nota interna · / buscar · t tema`, e à direita `3 de 10 · PT-4816`.
- **Vazio:** régua de 56×2px, "Fila limpa." (Archivo 800 26px), parágrafo 14px em `--muted-foreground`, e dois botões (`Ver os 3 resolvidos hoje`, `Abrir task interna`). Boa notícia, não falha.
- **Carregando:** skeleton na mesma grade + `carregando 12 chamados de checkout…` em mono 11px.
- **Erro:** régua de 56×2px em `--ai`, "Não consegui carregar a fila.", parágrafo dizendo o que não foi perdido, `<pre>` mono com o request e o `req_id`, botões `Tentar carregar de novo` (ai) e `Ver status dos serviços`.

### 2. Chamado aberto
**Objetivo:** ler o caso, decidir quem atende, responder ao autor e registrar contexto interno.
**Layout:** central `flex-1` (rola por dentro) + rail direito 268px (`border-left: 2px`). Cabeçalho de 8px/16px com `← fila`, id em mono, título 14px 600, seletor do bloco de IA e seletor de estado.
- **Bloco de IA** no topo — ver a especificação completa em `PROMPT_CLAUDE_CODE.md` (é a peça central; três estados: alta 0.86, baixa 0.41, ausente).
- **Conversa:** rótulo `conversa` (kicker) + régua 1px + contagem. Mensagem visível = autor 13px 600 + metadado mono 10.5px + corpo 14px, máx. 68ch, sem moldura. **Nota interna = outra coisa:** `bg-card`, `border-top: 2px`, `border-bottom: 1px`, rótulo mono uppercase `nota interna` e a marca `a autora não vê isto`.
- **Compositor sticky no rodapé** (`border-top: 2px`): duas abas (`resposta à autora` / `nota interna`), textarea 2 linhas, botão em tinta e dica em mono. A aba troca fundo do campo (`--background` ↔ `--card`), placeholder, rótulo do botão (`Responder a Camila` ↔ `Salvar nota interna`) e a dica (`sai por whatsapp e por e-mail · a autora recebe agora` ↔ `não vai para a autora · fica no histórico do chamado`).
- **Rail direito:** `metadados` em grid `78px 1fr` (projeto, origem com telefone mascarado, autora + nº de chamados, aberto, 1ª resposta, estado, prioridade) · `código` (branch sugerida, base + sha, botão `Criar branch e abrir PR`) · `atividade` em mono, ordem decrescente, incluindo `09:09 · Patch sugeriu Marina (0.86)`.
- **Carregando/erro:** skeleton da conversa; no erro, a conversa carrega e só a sugestão falha — texto diz isso e oferece `Pedir a sugestão de novo` / `Seguir sem sugestão`.

### 3. Projeto
Cabeçalho com nome (Archivo 800 22px), repo em mono, `Reindexar repositório`. Faixa de quatro números em células iguais separadas por 1px, com `border-bottom: 2px`: chamados abertos 12 (4 sem responsável) · 1ª resposta mediana 1h 40m (acordo 4h) · sugestões aceitas 17/25 (8 trocadas à mão) · vence hoje 2 (ids em mono). Números em **mono 22px 500**, tabular — sem seta, sem porcentagem verde. Abaixo, grid `minmax(0,1fr) 320px`: à esquerda a lista de chamados abertos (linhas de 36px, `84px minmax(90px,1fr) auto`); à direita repositório conectado (repo, branch padrão, app e permissões, última indexação com duração e commit, estado) · pastas sem dono declarado · notas de contexto marcadas como `lidas pela IA` + `Editar notas`.

### 4. Equipe e expertise
Grid `200px minmax(0,1fr) minmax(0,1fr) 120px`: pessoa (nome 13.5px 600 + papel em mono 10.5px) · áreas declaradas · áreas inferidas do git · último commit. **A origem do dado é visível:** declarada = chip de borda sólida em `--foreground`; inferida = chip de **borda tracejada** em `--muted-foreground` com a prova ao lado (`41 commits`, `sinal fraco`). Legenda no cabeçalho com os dois chips explicados. Casos que o desenho precisa cobrir: pessoa com declarado e sem inferido (o PO), pessoa com inferido e sem declarado (dev novo), inferência de sinal fraco. Rodapé: `Declarar uma área` + a regra em mono: "área declarada pesa mais que inferida na sugestão — e a inferida nunca vira declarada sozinha".

### 5. Portal público `/support/[projeto]`
Uma coluna, calma, responsiva; base 15–16px, respiro 24–32px. Marca = quadrado de 12px em `--project-accent` + nome do projeto (Archivo 800 15px) + `suporte` em mono + link `meus chamados`. Título "Conte o que aconteceu." (32px desktop / 25px mobile), subtítulo dizendo quem lê e em quanto tempo. Campos: `O que deu errado?` (textarea 4 linhas + dica), `Onde você estava?` (select), `Seu e-mail` (+ "É por aqui que a resposta chega."). Ações: `Abrir chamado` (46–50px, fundo `--project-accent`, rótulo à esquerda), `Anexar um print`, e a garantia "Você recebe um número de acompanhamento na hora." Abaixo, `Seus chamados` com status em palavra humana (`Em análise`, `Resolvido`) e data em mono. Rodapé com horário de atendimento. **Zero jargão interno** — sem id `PT-`, sem `sugerido`, sem nome de branch. Variação por projeto: só nome e cor.

### 6. Tokens (`/design`, rota interna)
Página de referência viva: 6 papéis de cor com hex claro/escuro e a justificativa em uma linha, escala tipográfica em tamanho real com os três papéis, escala de espaço (4·8·12·16·24·32) e as duas réguas (1px entre linhas iguais, 2px entre seções), mais as regras "nenhum verde/amarelo" e "linha de fila 36px".

## Interações e comportamento

- **Atalhos:** `j`/`k`/setas movem a seleção (com wrap) · `enter` abre o chamado · `a` aceita a sugestão · `i` vai para o compositor em nota interna e foca · `/` foca a busca · `t` cicla sistema → claro → escuro · `esc` volta para a fila. Todos ignorados quando o foco está em campo de texto.
- **Aceitar sugestão:** o bloco de IA é substituído por uma barra de 1px (`atribuído · Marina Alencar · sugestão aceita · hoje 09:15 · por você`) com `Desfazer`. Otimista na UI, com rollback se a API falhar.
- **Evidência:** a primeira linha expande/colapsa o trecho de código (glyph `▾`/`▸`); começa expandida.
- **Sem transição decorativa.** Só o `animate-pulse` do skeleton, desligado sob `prefers-reduced-motion`.
- **Rolagem:** a raiz não rola; header, rails e barra de atalhos ficam parados. O compositor é sticky no fim da coluna de conversa.
- **Responsivo:** o app interno é desktop-first e precisa sobreviver a 924px sem célula invadindo coluna vizinha (use `minmax(0,1fr)` + `truncate`, metadado em `auto`). O portal público é mobile-first de verdade (390px).

## Estado

`screen` · `selectedRow` (índice para j/k) · filtros (`projeto`, `status`, `responsavel`, `origens[]`) · `queueState` (dados/vazio/carregando/erro — no app, derivado do fetch) · `ticketState` · `suggestion` (`{ person, confidence, rationale, evidence[], model, indexedAt } | null`) · `accepted` + `acceptedBy/At` · `evidenceExpanded` · `composerTab` (`autor` | `interna`) · `theme` (next-themes, padrão sistema) · `density` (36/32/28, opcional).

Dados: fila e chamado por fetch normal; a sugestão em endpoint separado (`POST /api/suggest/:id`) porque pode falhar sozinha e demora mais — a conversa nunca espera por ela. Faixas de confiança: `>= .70` alta · `< .55` baixa · sem pessoa = estado ausente.

## Tokens de design

Todos em `tokens/globals.css`. Resumo:

| Papel | Claro | Escuro | Por quê |
| --- | --- | --- | --- |
| papel (ground) | `#f3f2f2` | `#191817` | ground do Modernist; no escuro desce abaixo do neutro-900 para o texto não vibrar |
| superfície | `#eae9e9` | `#211f1e` | separa nota interna, código e painel sem sombra |
| tinta | `#201e1d` | `#f3f2f2` | texto e réguas; a hierarquia vem da régua, não da cor |
| grafite | `#605d5d` | `#b3afae` | id, hora, caminho: um só neutro médio para os dois temas |
| rubro (IA) | `#ec3013` | `#ff563c` | exclusivo da camada de IA e da ação primária dela |
| rubro fundo | `#ae1800` | `#ff9783` | rubro em tamanho de corpo, onde o accent puro não passa contraste |

Réguas: 1px `color-mix(ink 20%)` · 2px `color-mix(ink 40%)`. Espaço: 4 · 8 · 12 · 16 · 24 · 32. Linha de fila 36px (densa 32, compacta 28). Raio 0 em tudo. Sombra só em Dialog/Popover (`--shadow-lg`). Tipos: Archivo 400/500/600/800 (display 40/32/30/26/22, texto 16/15/14/13.5/13/12.5) e IBM Plex Mono 400/500 (12/11.5/11/10.5/10).

## Assets

Nenhuma imagem. Fontes: Archivo e IBM Plex Mono, Google Fonts (`next/font` recomendado). Ícones: Lucide, 14–16px, sempre com rótulo — o protótipo usa glyphs de texto (`◆ · ▾ ▸ ← §`) que podem virar Lucide (`Diamond`, `ChevronDown`, `ChevronRight`, `ArrowLeft`) na implementação.

## Arquivos

- `PROMPT_CLAUDE_CODE.md` — prompt de design para colar junto com o prompt de produto. **Comece por aqui.**
- `tokens/globals.css` — tokens de tema (Tailwind v4 + shadcn; nota para v3 no fim do arquivo).
- `tokens/shadcn-map.md` — primitiva por primitiva: o que usar, o que sobrescrever, o que não usar.
- `reference/Patch.dc.html` — protótipo navegável das 6 telas e de todos os estados.
- `reference/support.js` — runtime que faz o protótipo abrir sozinho no navegador (não vai para o produto).
- `reference/_ds/modernist-489684c5-c414-415b-a8f3-61e54d70d970/styles.css` — folha de tokens do design system Modernist, como referência canônica das cores e ramps.
