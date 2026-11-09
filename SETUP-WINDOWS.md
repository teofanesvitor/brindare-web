# Brindare Web — instalação no Windows

## Pré-requisitos

- Node.js 22 LTS (compatível com a CI e com o adaptador Cloudflare).
- VS Code e Git.
- Projeto Supabase criado.

## Instalar dependências

No PowerShell, na pasta do projeto:

```powershell
node -v
npm.cmd -v
npm.cmd ci
```

Se o PowerShell bloquear `npm.ps1`, use `npm.cmd`.

## Configurar variáveis

Copie `.env.example` para `.env.local` e preencha os valores reais:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE
ADMIN_EMAILS=admin1@empresa.com,admin2@empresa.com
```

A chave service role é privilegiada: mantenha-a somente no ambiente server-side e nunca use o prefixo `NEXT_PUBLIC_`. Não envie `.env.local` ao GitHub.

## Banco de dados e Storage

No Supabase, abra SQL Editor e execute **uma única vez cada migration, na ordem abaixo**:

1. `supabase/migrations/202611020001_initial_profiles.sql`
2. `supabase/migrations/202611020002_contracts.sql`
3. `supabase/migrations/202611030001_agenda_estoque_clientes.sql`
4. `supabase/migrations/202611030002_client_event_details.sql`
5. `supabase/migrations/202611030003_link_events_to_contracts.sql`
6. `supabase/migrations/202611040001_event_toast_time.sql`
7. `supabase/migrations/202611050001_contracts_docx_storage.sql`
8. `supabase/migrations/202611050002_event_payments_cashflow.sql`
9. `supabase/migrations/202611050003_event_signed_contracts.sql`
10. `supabase/migrations/202611090001_deploy_hardening.sql`

A última migration corrige permissões multiadministrador, serializa movimentações de estoque, torna atômico o registro de contrato/evento e alinha o bucket privado aos tipos de arquivo aceitos (PDF, DOCX, JPG e PNG, até 10 MB).

## Administradores

Configure `ADMIN_EMAILS` com os endereços reais da equipe e execute em uma máquina confiável:

```powershell
npm.cmd run provision:admins
```

O script usa a service role para convidar e promover administradores. Não execute esse processo em navegador ou código cliente.

## Executar e validar

```powershell
npm.cmd run dev
```

Abra http://localhost:3000.

Antes de utilizar dados reais, execute:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run preview
```

## Contratos

O gerador atual produz DOCX usando o modelo versionado em `src/templates/contract-template.docx` e armazena o arquivo no bucket privado `contracts`. Não exige credenciais Google para esse fluxo.

**Atenção:** a cláusula jurídica oficial referente a fogos ainda precisa ser fornecida/confirmada. Até isso ocorrer, o sistema bloqueia a geração de contratos quando a quantidade de fogos for maior que zero, para não emitir um documento sem a cláusula prevista.

## Cloudflare

O deploy de teste usa OpenNext + Wrangler. Consulte `CLOUDFLARE-DEPLOYMENT.md`. Não execute `npm run deploy` antes de concluir build, preview e testes funcionais. A branch de teste não altera `main`.
