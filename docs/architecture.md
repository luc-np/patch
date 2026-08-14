# Arquitetura do Patch — decisões e porquês

## Topologia

Quatro peças no Render, nada mais: **1 Web Service** (Next.js full-stack),
**1 Background Worker** (pg-boss), **1 Cron Job** (dispara a sincronização dos
repos a cada 30 min) e **1 Postgres gerenciado**. Web e worker compartilham o
mesmo código; o worker roda com `tsx` direto, sem bundle — o volume de jobs é
baixo e a simplicidade vence.

## Um banco só: Postgres + pgvector

Dados relacionais, fila (pg-boss no schema `pgboss`) e vetores
(`document_chunks.embedding vector(1024)`, índice HNSW por cosseno) vivem no
mesmo Postgres. Evita um Redis só para fila e um vetor-store separado — menos
peças, menos modos de falha, transações onde importa.

**Drizzle** foi escolhido pelo suporte nativo a `vector` e `cosineDistance`:
a parte mais crítica do sistema não escapa para SQL cru. As duas exceções
deliberadas são pequenas: os fragments de `tsquery/ts_rank` na busca full-text
e a coluna gerada `tsvector` (customType na migration).

## Autorização: uma camada, 404 em vez de 403

Toda permissão mora em `lib/auth/policies.ts` como funções puras sobre um
`Actor {id, role, projectIds}` — nenhum `if` de permissão em componente ou
handler. Os services carregam o recurso e aplicam a policy antes de devolver;
leitura negada vira o **mesmo `not_found` de um recurso inexistente** (404,
não 403), para que um guest não consiga sequer confirmar que o chamado de
outro guest existe. Isso é coberto por testes unitários (as policies) e por um
teste de integração com banco real (o service inteiro).

O papel global (`admin | staff | guest`) vive no usuário como campo do
better-auth com `input: false` — o cadastro público nunca escolhe papel; o
único caminho para admin é o seed.

## Filas e idempotência

pg-boss com cinco filas tipadas (`lib/queue.ts`): `triage`, `ingestion`
(singletonKey por projeto — nunca duas sincronizações do mesmo repo),
`email`, `whatsapp-inbound` (singletonKey por message_id) e `whatsapp-send`.

O webhook do WhatsApp verifica a assinatura HMAC sobre o corpo cru **antes de
qualquer parse**, enfileira e responde 200 imediatamente — a Meta re-entrega
em timeout. A idempotência tem três camadas: 200 rápido, singletonKey no
enqueue e `UNIQUE(ticket_messages.external_id)` com `onConflictDoNothing` no
insert. Testada com replay do mesmo payload.

A **janela de 24h** da Meta é derivada de `whatsapp_contacts.last_inbound_at`
e mostrada no rail do chamado ("fecha em 3h" / "fechada"); mensagem fora da
janela registra `delivery.status = window_closed` explicitamente — nada falha
em silêncio. Envio por template aprovado ficou fora do MVP de propósito.

## RAG: o git é a fonte da verdade

A ingestão roda no worker: clone parcial (`--filter=blob:none` — barato como
shallow, mas preserva o histórico completo para o `code_ownership`) em disco
efêmero, diff incremental entre o último sha indexado e o HEAD, e reindexação
apenas do que mudou (dedup por sha256 do conteúdo — embedding custa dinheiro).
O app nunca guarda cópia divergente de um `.md` do repo; `project_notes` são
informação que só existe no app e carregam `kind: project_note` no metadado.

**Scrub de segredos antes de qualquer chamada externa**: `.env*` e chaves são
descartados pelo caminho sem nem serem lidos; o conteúdo restante passa por
regexes (AWS, GitHub, Anthropic, Slack, Stripe, PRIVATE KEY, connection
string, JWT) e por entropia de Shannon com dica de atribuição na linha. Um
match **descarta o arquivo inteiro** — mascarar deixaria vazar contexto — e o
descarte fica registrado em `ingestion_runs.stats.discarded`. Coberto por
testes obrigatórios; na prática o scrub já descartou o `drizzle.config.ts`
deste próprio repo (connection string com senha de dev).

**Busca híbrida**: similaridade vetorial (HNSW, cosseno) + full-text
(`tsvector` com config `simple`, porque o conteúdo mistura pt-BR, inglês e
código — stemming atrapalharia nome de função e código de erro), fundidas por
**Reciprocal Rank Fusion** em TypeScript puro e testado. `projectId` é
obrigatório nas duas pernas: um projeto nunca recupera contexto de outro.

## Triagem: uma sugestão, nunca uma atribuição

O job de triagem: busca híbrida com título+corpo → candidatos determinísticos
(apenas staff do projeto; `code_ownership` com decaimento de meia-vida de 180
dias + `member_expertise` com declarada pesando 2× a inferida) → uma chamada
ao Claude com saída estruturada (Zod) → **gate de confiança** puro e testado.

O gate rebaixa para "sem sugestão" três casos: o modelo devolveu null, a
confiança ficou abaixo de `TRIAGE_CONFIDENCE_MIN`, ou o id sugerido não está
entre os candidatos válidos (alucinação). Uma sugestão errada com cara de
certeza custa mais que nenhuma — o estado ausente é uma resposta honesta com
ações concretas, não uma falha.

O conteúdo do chamado entra no prompt **delimitado como dado não confiável**
(`<ticket_content>` + instrução explícita de ignorar comandos embutidos), em
toda chamada que inclui texto vindo de fora (triagem e edição de Markdown).

Toda sugestão é gravada em `assignment_suggestions` — inclusive as vazias e
as recusadas. É o único jeito de medir se a IA está acertando (a tela do
projeto mostra `aceitas/decididas` e `trocadas à mão`).

## Markdown → PR

Sob demanda, nunca automático. O fluxo é sempre: IA gera a nova versão do
`.md` → o **diff é revisado por um humano na UI** → branch `patch/pt-<n>` →
commit → PR via GitHub App (octokit) → link devolvido como nota interna.
Nunca commit direto na branch padrão; o servidor valida que o caminho termina
em `.md` e existe na branch padrão antes de qualquer coisa.

## IA atrás de uma interface

`lib/ai/provider.ts` define `embed`, `generateTriage` e
`generateMarkdownEdit`. As implementações (Anthropic, Voyage) são detalhes;
trocar de modelo não refatora o app. A dimensão do embedding (1024) vive num
único lugar — trocar de modelo de embedding exige migration e reindexação
total, então isso é uma decisão explícita, não um efeito colateral.

Em dev sem `VOYAGE_API_KEY`, um provider fake determinístico (hash de
trigramas) exercita o pipeline de ponta a ponta; em produção a ausência de
chave é erro, nunca fallback.

## Simplificações deliberadas

- Rate limit em memória (token bucket) — 1 instância web; virar tabela se escalar.
- RRF em TypeScript em vez de CTE SQL — testável, e a latência é irrelevante no volume.
- Chunking hand-rolled (heading de Markdown por regex; código em janelas de
  120 linhas com overlap de 20) — sem parser como dependência.
- Guest provisório de WhatsApp (`+55...@wa.invalid`) sem login até se cadastrar.
- Sem virtualização na fila até ~200 linhas.
- Nada de preparo para o que está fora do MVP: IA alterando código de
  aplicação, Jira/Linear, multi-tenant, mobile, billing.
