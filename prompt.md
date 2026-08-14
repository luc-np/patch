Prompts iniciais — App interno de suporte/tasks com RAG

Dois prompts independentes. O primeiro é para o Claude Code (arquitetura + código). O segundo é para o Claude Design (identidade visual e telas). Cada um é autocontido: pode colar sem contexto adicional.

PROMPT 1 — Claude Code

Você vai construir do zero uma aplicação interna de suporte e tasks para um time de desenvolvimento pequeno, com uma camada de IA que conhece os projetos do time e ajuda na triagem.

Antes de escrever qualquer código: leia este briefing inteiro, me apresente um plano de execução por fases e espere minha confirmação. Não gere o projeto todo de uma vez.

1. Objetivo

Centralizar dois fluxos que hoje estão espalhados:

Tasks internas organizadas por projeto, com responsável, status e prioridade.
Chamados de suporte que chegam de fora (WhatsApp e um portal público por projeto).

Em cima disso, uma camada de IA com RAG que indexa os repositórios git dos projetos e responde a uma pergunta prática: quando um chamado chega, quem do time deveria pegar e por quê. Com o tempo, a mesma base de conhecimento deve sustentar sugestões de onde no código o problema provavelmente está, e a manutenção da documentação em Markdown.

2. Stack e infraestrutura — restrições fixas
   Next.js (App Router, TypeScript strict) como aplicação full-stack. Sem backend separado.
   PostgreSQL + extensão pgvector como único banco: dados relacionais, fila e vetores no mesmo lugar.
   Hospedagem: Render. A arquitetura precisa caber em: 1 Web Service (Next.js), 1 Background Worker (processamento assíncrono), 1 Cron Job (sincronização periódica dos repos), 1 Postgres gerenciado.
   ORM: Drizzle. Motivo: suporte nativo ao tipo vector e às operações de distância do pgvector, sem escapar para SQL cru na parte mais crítica do sistema. Migrations versionadas no repo.
   Fila: pg-boss em cima do mesmo Postgres. Evita um Redis só para isso, e o volume de jobs aqui é baixo.
   Embeddings e LLM atrás de uma interface própria (lib/ai/provider.ts), nunca chamados direto dos handlers. Quero trocar de modelo sem refatorar o app.

Nada de serviço externo pago além do provedor de LLM/embeddings e da API do WhatsApp.

3. Escopo do MVP

Dentro:

Autenticação, projetos, membros, tasks e chamados.
Portal público de abertura de chamado por projeto.
Ingestão de chamados vindos do WhatsApp.
Indexação dos repositórios git (somente leitura) e busca semântica.
Sugestão automática de responsável ao criar um chamado.
Sugestão de edição em arquivos .md, entregue como Pull Request.

Fora do MVP, e não quero código preparatório para isso: a IA alterar código de aplicação, integração com Jira/Linear, multi-tenant, app mobile, billing, relatórios avançados.

4. Modelo de domínio

Modele pelo menos estas entidades. Nomes em inglês, comentários e mensagens de interface em português do Brasil.

Núcleo

users — nome, e-mail, senha (hash), tipo global: admin | staff | guest.
projects — nome, slug, descrição, repo_url, branch padrão, flag de portal público ativo.
project_members — vínculo usuário↔projeto com papel: dev | cs | qa | designer | po | collaborator.
expertise_areas — áreas nomeadas dentro de um projeto ("checkout", "integração fiscal", "editor de arte"), com descrição e uma lista de globs de caminho associados.
member_expertise — liga membro↔área, com source: manual | git e um peso. A entrada manual é o seed; o sinal do git é acumulado.
code_ownership — derivado do histórico do git: por caminho de arquivo, quantos commits cada usuário fez e quando foi o último. É o que transforma "acho que é do fulano" em dado.

Trabalho

tickets — tipo (task | support | bug), projeto, título, corpo, status, prioridade, autor, responsável, origem (portal | whatsapp | internal), referência externa.
ticket_messages — thread, com flag internal para notas que o autor externo não vê.
assignment_suggestions — ticket, usuário sugerido, justificativa em texto, score de confiança, trechos usados como evidência, e se foi aceita ou não. Guarde sempre, inclusive as recusadas: é o único jeito de medir se a IA está acertando.

Conhecimento

project_notes — informação que eu escrevo dentro do app sobre um projeto (contexto de negócio, decisões, quirks, clientes). Entra no índice junto com o código.
documents — unidade indexável: origem (repo_file | project_note | ticket), caminho, sha do git, hash do conteúdo.
document_chunks — texto do chunk, embedding vector(N), metadados em jsonb (linguagem, caminho, faixa de linhas, heading).
ingestion_runs — auditoria de cada sincronização: repo, commit inicial e final, contagens, erros.

Transversal

whatsapp_contacts — telefone ↔ usuário/projeto.
audit_log — quem fez o quê, com destaque para ações originadas pela IA. 5. Papéis e permissões

Três níveis, com a autorização centralizada em uma única camada (lib/auth/policies.ts). Nenhuma verificação de permissão espalhada em componente ou handler.

admin — tudo: cria projetos, cadastra membros, define áreas de expertise, configura repos.
staff (dev, cs, qa, designer, po) — vê e opera os projetos em que é membro. Notas internas visíveis.
guest (colaborador externo) — vinculado a um ou mais projetos específicos, mas enxerga apenas os chamados que ele mesmo criou, e apenas as mensagens públicas da thread. Não é funcionário, não vê o time, não vê tasks internas, não vê outros chamados.

O caso do guest é o mais fácil de vazar dado. Escreva testes de autorização para ele antes de escrever a interface: um guest tentando ler ticket de outro guest no mesmo projeto deve receber 404, não 403.

6. Fluxos
   6.1 Portal público — /support/[project_slug]

Página pública por projeto. Quem chega precisa ter conta: cadastro simples (nome, e-mail, senha, verificação por e-mail) e então abre o chamado. Depois de abrir, acompanha em /meus-chamados e recebe as respostas do time por e-mail. Um projeto pode ter o portal desligado.

6.2 WhatsApp

Webhook da WhatsApp Cloud API (Meta). Requisitos:

Verificação da assinatura do webhook (X-Hub-Signature-256) antes de qualquer processamento.
Responder 200 imediatamente e enfileirar o processamento. A Meta re-entrega em caso de timeout — o handler precisa ser idempotente por message_id.
Mapear telefone → whatsapp_contacts. Telefone desconhecido gera um guest provisório e um chamado no projeto configurado para aquele número.
Atenção à janela de 24h de atendimento da Meta: fora dela, só é possível responder via template aprovado. Trate isso explicitamente em vez de deixar a mensagem falhar em silêncio — a interface deve mostrar quando a janela está fechando.
6.3 Triagem

Ao criar um chamado (qualquer origem), um job assíncrono:

Recupera contexto relevante via busca híbrida.
Identifica os arquivos/áreas mais prováveis.
Cruza com code_ownership e member_expertise.
Produz um único responsável sugerido, com justificativa em uma ou duas frases, score de confiança e os trechos/arquivos que embasaram a escolha.

Sem ranking, sem lista de alternativas. Se a confiança ficar abaixo do limite configurado, não sugira ninguém — diga que não há sinal suficiente. Uma sugestão errada com cara de certeza custa mais caro que nenhuma sugestão.

A sugestão nunca atribui automaticamente. Um humano aceita ou escolhe outra pessoa, e essa decisão é registrada.

7. Camada de RAG
   Fontes
   Arquivos dos repositórios git dos projetos.
   project_notes escritas dentro do app.
   Chamados já resolvidos (título, corpo, resolução).

O git é a fonte da verdade da documentação. O app nunca guarda uma cópia divergente de um .md do repo — indexa o conteúdo com o sha do commit e reindexa quando muda. As project_notes são informação adicional que só existe no app, e devem ser claramente marcadas como tal nos metadados.

Ingestão

Job no Background Worker, disparado por Cron (a cada 30 min) e manualmente:

Clone --depth limitado ou fetch incremental em disco efêmero; processa por diff entre o último commit indexado e o HEAD.
Filtro de entrada: ignore node_modules, vendor, dist, build, .next, lockfiles, binários, imagens, minificados, e qualquer arquivo acima de um limite de tamanho.
Scrub de segredos obrigatório antes de qualquer chamada externa: remova .env\* e derivados por completo; aplique detecção por regex (chaves AWS, tokens de provedores, PRIVATE KEY, connection strings) e por entropia sobre o conteúdo que sobrar. Um arquivo com match é descartado, não mascarado. Registre em ingestion_runs o que foi descartado e por quê.
Chunking sensível ao tipo: Markdown por heading, preservando a hierarquia no metadado; código em blocos com sobreposição, carregando caminho do arquivo e faixa de linhas.
Deduplicação por hash de conteúdo — não reembede o que não mudou. Embedding custa dinheiro e tempo.
Além dos arquivos, processe o histórico de commits: mensagem, autor, arquivos tocados. É isso que alimenta code_ownership.
Recuperação

Busca híbrida: similaridade vetorial (pgvector, índice HNSW, distância de cosseno) combinada com full-text search do Postgres (tsvector), fundidas por Reciprocal Rank Fusion. Busca puramente semântica erra feio em nome próprio de módulo, código de erro e nome de função — exatamente o vocabulário de um chamado de suporte.

Filtro obrigatório por project_id em toda query. Um projeto nunca recupera contexto de outro.

8. Gestão de arquivos Markdown

Sob demanda (nunca automático), a IA propõe alterações em arquivos .md do repo: atualizar documentação após um chamado resolvido, corrigir instrução defasada, criar um runbook.

O fluxo é sempre: gerar diff → criar branch → abrir Pull Request via API do GitHub → devolver o link no app. Nunca commit direto na branch padrão. Nunca tocar em arquivo que não seja .md nesta fase.

9. Segurança
   Todo segredo em variável de ambiente, nada no cliente. Chaves de LLM só no servidor e no worker.
   Acesso ao git por GitHub App com permissão de leitura de conteúdo e escrita de PR — não use PAT pessoal.
   Rate limit no portal público e nos endpoints de cadastro.
   Validação de entrada com Zod em toda fronteira: route handlers, server actions, webhooks.
   Conteúdo de chamado vindo de fora é entrada não confiável dentro do prompt da IA. Delimite-o explicitamente e instrua o modelo a tratá-lo como dado, não como instrução.
10. Convenções de engenharia
    TypeScript strict. Nada de any — se o tipo é desconhecido, é unknown com narrowing.
    Camadas separadas: db/ (schema e queries), services/ (regra de negócio pura e testável), app/ (rotas e UI). Regra de negócio não mora em componente React.
    Erros como valores nas operações que podem falhar de forma esperada; exceções só para o inesperado.
    Logging estruturado em JSON com correlation id, principalmente nos jobs.
    Testes: Vitest para services e políticas de autorização. Cobertura obrigatória em permissões, scrub de segredos e idempotência do webhook. O resto é opcional no MVP.
    Commits pequenos e descritivos. Um README.md com setup local e um docs/architecture.md com as decisões e o porquê de cada uma.
11. Fases de entrega

Entregue uma fase por vez, funcionando de ponta a ponta, e pare para eu revisar antes da seguinte.

Fundação — schema, auth, projetos, membros, áreas de expertise, CRUD de tickets, camada de autorização com testes, deploy no Render.
Entrada de chamados — portal público /support/[slug], cadastro de guest, notificação por e-mail, thread com mensagens públicas e internas.
WhatsApp — webhook, idempotência, mapeamento de contatos, envio de resposta, tratamento da janela de 24h.
Conhecimento — ingestão git, scrub, chunking, embeddings, busca híbrida, project_notes, tela de status da indexação.
Triagem — motor de sugestão de responsável com justificativa, evidências, limite de confiança e registro de aceite/recusa.
Markdown — proposta de edição em .md e abertura de PR. 12. Como trabalhar
Comece pelo plano da Fase 1 e pelo schema completo, e discuta comigo antes de implementar.
Onde eu deixei uma decisão em aberto, escolha o caminho mais simples que atende o requisito e me diga o que escolheu e por quê, em uma linha.
Se algum requisito meu estiver errado ou for caro demais para o valor que entrega, fale. Prefiro discordância a implementação silenciosa.
Não crie abstração para um caso de uso que ainda não existe.
