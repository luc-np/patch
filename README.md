# Patch

Ferramenta interna de suporte e tasks para um time pequeno, com uma camada de
IA que conhece os repositórios do time e **sugere** quem deve pegar cada
chamado — com justificativa, evidência e confiança honesta. A sugestão nunca
atribui sozinha: um humano decide, e toda decisão fica registrada.

Chamados entram por três origens — portal público por projeto, WhatsApp
(Cloud API da Meta) e criação interna — e a base de conhecimento (RAG) indexa
o código dos repositórios, as notas de contexto escritas no app e os chamados
já resolvidos.

## Stack

- **Next.js** (App Router, TypeScript strict) full-stack — sem backend separado
- **PostgreSQL + pgvector** — dados relacionais, fila e vetores no mesmo banco
- **Drizzle ORM** com migrations versionadas · **pg-boss** como fila
- **Anthropic (Claude)** para triagem/geração · **Voyage AI** para embeddings —
  ambos atrás de `lib/ai/provider.ts`
- Tailwind v4 + shadcn/ui, tokens do design system Modernist em `app/globals.css`
- Deploy no **Render**: 1 web, 1 worker, 1 cron, 1 Postgres (`render.yaml`)

## Setup local

Pré-requisitos: Node 20+, Docker Compose.

```sh
cp .env.example .env          # ajuste os segredos; as chaves de IA são opcionais em dev
docker compose up -d           # Postgres (pgvector) + Mailpit (SMTP fake, UI em :8025)
npm install
npm run db:migrate             # aplica as migrations (inclui CREATE EXTENSION vector)
npm run db:seed                # admin inicial (admin@patch.local / patch-admin-123) + projeto exemplo
npm run dev                    # web em http://localhost:3000
npm run worker                 # em outro terminal: processa filas (e-mail, triagem, ingestão…)
```

- E-mails de verificação e notificação chegam no Mailpit: <http://localhost:8025>.
- Sem `VOYAGE_API_KEY`, a ingestão usa embeddings fake determinísticos (só em
  dev) para exercitar o pipeline; sem `ANTHROPIC_API_KEY`, a triagem falha com
  erro claro no worker — o resto do app funciona normalmente.
- Ingestão manual: botão "Reindexar repositório" na tela do projeto, ou
  `npx tsx scripts/enqueue-ingestion.ts`.

## Testes

```sh
npm test        # Vitest: políticas de autorização, isolamento de guest (banco real),
                # scrub de segredos, idempotência do webhook, RRF e gate de triagem
npm run typecheck
```

## Estrutura

```
db/         schema Drizzle e migrations
lib/        env, auth (better-auth + policies), IA (provider), filas, e-mail, whatsapp, github
services/   regra de negócio pura (tickets, mensagens, triagem, busca, ingestão…)
worker/     processo do Background Worker (pg-boss)
app/        rotas e UI: (app) interno · (portal) público · api/ webhooks e endpoints
components/ shadcn em ui/, componentes do produto em patch/
tests/      Vitest
```

As decisões de arquitetura e o porquê de cada uma estão em
[`docs/architecture.md`](docs/architecture.md). A referência viva dos tokens de
design fica na rota interna `/design`.

## Variáveis de ambiente

Veja `.env.example`. Em produção, todo segredo vive em variável de ambiente do
Render (grupo `patch-env` no `render.yaml`); nada vai para o cliente. O acesso
ao GitHub é via **GitHub App** (leitura de conteúdo + escrita de PR), nunca PAT
pessoal.
