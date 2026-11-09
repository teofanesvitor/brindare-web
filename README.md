# Brindare Web

Sistema administrativo interno da Brindare para cinco administradores. Stack: Next.js 15, TypeScript, Supabase Auth/PostgreSQL/Storage e OpenNext para Cloudflare Workers.

## Funcionalidades

- Autenticação e autorização de administradores.
- Cadastro de clientes e link público de pré-cadastro com token de uso único.
- Agenda de eventos.
- Controle de estoque e movimentações.
- Registro de pagamentos e acompanhamento financeiro.
- Geração de contratos DOCX a partir do modelo oficial.
- Upload privado de contratos assinados.

## Requisitos

- Node.js 22 LTS e npm.
- Projeto Supabase.
- Git.

## Instalação

No Windows, siga `SETUP-WINDOWS.md`. Em resumo:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preencha as variáveis de `.env.local`. A service role é necessária apenas para operações server-side privilegiadas e para o script de provisionamento. Nunca exponha essa chave em variáveis `NEXT_PUBLIC_*`, no navegador ou no Git.

## Banco de dados

Aplique todas as migrations de `supabase/migrations/` em ordem cronológica. A lista completa e o procedimento para Windows estão em `SETUP-WINDOWS.md`.

As migrations são aditivas. Não edite migrations já aplicadas em ambientes existentes; crie uma nova migration para toda alteração de schema, RLS ou Storage.

## Provisionamento dos administradores

Configure `ADMIN_EMAILS` com os e-mails reais (um a cinco) e execute em ambiente confiável:

```bash
npm run provision:admins
```

O script usa `SUPABASE_SERVICE_ROLE_KEY` para enviar convites e atribuir a role administrativa. Cada administrador define sua própria senha pelo convite.

## Verificações locais

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm run preview
```

O preview utiliza o runtime local do Cloudflare Workers via Wrangler. Um build Next.js bem-sucedido, isoladamente, não comprova compatibilidade com Workers.

## Deploy Cloudflare

O ambiente de teste está isolado na branch `deploy/cloudflare-free-test`. Consulte `CLOUDFLARE-DEPLOYMENT.md`.

Não faça merge em `main` nem execute deploy público antes de concluir a validação de runtime, autenticação, permissões, Storage e geração de documentos.

## Contratos DOCX

O fluxo atual preenche `src/templates/contract-template.docx`, armazena o resultado no bucket privado `contracts` e retorna URL assinada temporária. Esse fluxo não exige OAuth Google.

A geração com fogos está temporariamente bloqueada até que o texto jurídico oficial da cláusula de segurança seja confirmado e incorporado ao modelo. Essa proteção evita emitir contrato incompleto ou com redação jurídica inventada.

## Segurança e operação

- A autorização administrativa é validada no servidor e reforçada por RLS.
- O bucket de contratos é privado; URLs de download expiram.
- O campo `created_by` registra autoria, mas todos os administradores autorizados podem operar os eventos.
- Movimentações de estoque são serializadas no PostgreSQL para evitar saídas concorrentes acima do saldo.
- Contrato e evento são persistidos na mesma transação.
- Não comite `.env.local`, `.dev.vars`, tokens, chaves ou credenciais.

## Limitações do plano gratuito

O uso depende dos limites vigentes do Cloudflare Workers Free e do Supabase Free. Projetos Supabase Free podem pausar por inatividade e não incluem backup automático. Antes de usar dados operacionais, estabeleça exportação periódica e uma rotina de restauração testada.
