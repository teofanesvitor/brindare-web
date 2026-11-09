# Cloudflare Workers — ambiente de teste Brindare

A branch `deploy/cloudflare-free-test` prepara o deploy do sistema existente usando Next.js 15 + OpenNext + Wrangler. A branch `main` permanece intocada.

## Estado e pré-requisitos

- OpenNext e Wrangler configurados.
- Build e preview ainda precisam ser executados no runtime Workers.
- Nenhum deploy é executado automaticamente por este workflow.
- O workflow de compatibilidade usa apenas permissões GitHub de leitura e `npm ci` com o lockfile versionado.
- Nenhuma credencial real deve ser adicionada ao repositório ou aos logs de CI.

## Verificações

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
npm run preview
```

O preview é obrigatório antes do deploy. Validar especialmente middleware/cookies do Supabase, Server Actions, geração DOCX, uploads e downloads.

## Variáveis e secrets

Configurar no Worker:

- `NEXT_PUBLIC_SUPABASE_URL` — variável pública.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — variável pública.
- `NEXT_PUBLIC_APP_URL` — URL HTTPS `workers.dev` final.
- `SUPABASE_SERVICE_ROLE_KEY` — secret privado obrigatório para operações administrativas server-side.

Não usar prefixo `NEXT_PUBLIC_` na service role. O fluxo DOCX atual não necessita OAuth Google. Se outras rotas passarem a usar Google APIs, configurar os secrets somente após revisar sua necessidade.

Para preview local, utilizar `.dev.vars` (ignorado pelo Git) e manter apenas valores fictícios em `.dev.vars.example`.

## Supabase

1. Criar projeto no plano Free.
2. Aplicar todas as migrations em ordem, incluindo `202611090001_deploy_hardening.sql`.
3. Conferir políticas RLS e bucket privado `contracts`.
4. Configurar Site URL e Redirect URLs em Authentication para o endereço `workers.dev` e callback `/auth/callback`.
5. Provisionar administradores com o script local em ambiente confiável.

O bucket aceita DOCX, PDF, JPG e PNG, com limite de 10 MB. A migration de hardening ajusta políticas de eventos para permitir que todos os administradores operem a agenda e adiciona RPCs transacionais para estoque e criação de contrato/evento.

## Publicação sem custo

- Manter Workers no plano Free.
- Utilizar o subdomínio gratuito `workers.dev`.
- Não habilitar Workers Paid, R2 pago, domínio próprio pago ou serviços adicionais com cobrança.
- Confirmar no painel Cloudflare os limites e o plano antes de publicar.

O Supabase Free pode pausar projetos por inatividade e não fornece backup automático. Não considerar o ambiente adequado para dados reais sem exportação periódica e plano de recuperação testado.

## Limitações conhecidas antes da liberação

- A leitura do template DOCX em filesystem virtual precisa ser confirmada no preview Workers.
- A CPU do Workers Free pode limitar geração DOCX; medir com o modelo real.
- O tamanho comprimido do Worker deve ficar dentro do limite vigente do plano.
- A cláusula jurídica de segurança para fogos não foi recuperada do modelo/texto oficial; geração com fogos fica bloqueada até confirmação.
- Nenhum deploy de produção ou merge em `main` está autorizado por este procedimento.
