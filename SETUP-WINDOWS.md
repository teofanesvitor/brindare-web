# Brindare Web — instalação no Windows

## Pré-requisitos

- Node.js 20.9 ou superior (versão LTS recomendada).
- VS Code.
- Projeto Supabase criado.

## Instalar dependências

Abra o terminal PowerShell do VS Code na pasta que contém `package.json` e execute:

```powershell
node -v
npm.cmd -v
npm.cmd install
```

Use `npm.cmd` no PowerShell se a política de execução do Windows bloquear `npm.ps1`.

## Configurar Supabase

1. No Supabase, crie um projeto.
2. Abra as configurações de API do projeto.
3. Copie a Project URL e a chave pública `anon` ou `publishable`.
4. Na raiz do projeto, crie `.env.local` (ao lado de `package.json`) com:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. Salve o arquivo. Não coloque a chave `service_role` em uma variável `NEXT_PUBLIC_` e não compartilhe o `.env.local`.

Se as credenciais estiverem ausentes, o sistema abrirá `/setup` com instruções em vez de apresentar um erro de validação.

## Criar tabelas

No Supabase, abra SQL Editor e execute, nesta ordem, o conteúdo de:

1. `supabase/migrations/202611020001_initial_profiles.sql`
2. `supabase/migrations/202611020002_contracts.sql`

## Executar

```powershell
npm.cmd run dev
```

Abra http://localhost:3000.

## Verificações

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

## Observação sobre contratos

A geração real de contratos exige também as credenciais OAuth do Google descritas no `README.md`. Sem essas credenciais, o restante da aplicação pode ser configurado, mas a criação de documentos no Drive não estará disponível.
