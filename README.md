# Brindare Web — Fase 1

Fundação do sistema web administrativo da Brindare: Next.js + TypeScript, Supabase Auth/PostgreSQL, layout responsivo e provisionamento seguro de cinco administradores.

## Requisitos

- Node.js 20.9 ou superior (recomendado LTS)
- npm
- Projeto Supabase
- Git


## Instalação no Windows e tela de configuração

Consulte `SETUP-WINDOWS.md` para o passo a passo específico do PowerShell. Se as variáveis públicas do Supabase ainda não estiverem configuradas, a aplicação encaminha automaticamente para `/setup`, com instruções para criar o `.env.local`; assim, a falta de credenciais não causa mais o Runtime ZodError na abertura.

No PowerShell, use `npm.cmd` se o Windows bloquear a execução de `npm.ps1`: `npm.cmd install` e `npm.cmd run dev`.

## 1. Instalação local

```bash
npm install
cp .env.example .env.local
```

Edite `.env.local` com os valores reais do projeto Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave publicável/anon do projeto.
- `SUPABASE_SERVICE_ROLE_KEY`: chave privilegiada, somente para scripts server-side. Nunca publicar ou prefixar com `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_APP_URL`: `http://localhost:3000` no ambiente local.
- `ADMIN_EMAILS`: exatamente cinco e-mails distintos, separados por vírgula.

Não commitar `.env.local`.

## 2. Criar o banco e aplicar migration

No painel Supabase, abra **SQL Editor** e execute o conteúdo de:

`supabase/migrations/202611020001_initial_profiles.sql`

Alternativamente, instale a Supabase CLI, associe o projeto e execute:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

O arquivo cria `profiles`, o gatilho que cria perfil como `user` para novas contas, a função `is_admin()` e RLS. A aplicação não permite que usuários autenticados alterem sua própria role.

## 3. Provisionar os cinco administradores

Preencha `ADMIN_EMAILS` com cinco endereços reais da equipe. Em seguida:

```bash
npm run provision:admins
```

O script usa a chave service role somente no processo local, envia convite para os endereços e atribui a role `admin`. Cada pessoa define sua própria senha pelo convite recebido. O script valida que existam exatamente cinco e-mails distintos.

**Importante:** execute o provisionamento apenas por uma máquina confiável. Não disponibilize a service role no frontend, no GitHub ou em variáveis `NEXT_PUBLIC_*`.

## 4. Executar

```bash
npm run dev
```

Acesse http://localhost:3000. A rota `/` redireciona para `/dashboard`; sem sessão, o middleware atualiza a sessão e a proteção server-side direciona para `/login`.

## 5. Testes e verificações

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Os testes atuais validam a lista de cinco administradores (quantidade, duplicidade e formato de e-mail). A cobertura de regras de negócio será ampliada nas fases seguintes.

## 6. Deploy na Vercel

1. Envie este repositório para um repositório privado no GitHub.
2. Importe o repositório na Vercel.
3. Configure as variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_APP_URL` no projeto Vercel. **Não adicione `SUPABASE_SERVICE_ROLE_KEY` ao ambiente de produção do frontend**, a menos que uma futura função server-side explicitamente necessite dela e tenha sido revisada.
4. Configure `NEXT_PUBLIC_APP_URL` com o domínio HTTPS definitivo.
5. No Supabase, em Authentication → URL Configuration, configure Site URL e Redirect URLs para o domínio da aplicação e `http://localhost:3000/auth/callback` para desenvolvimento.
6. Faça o deploy. Execute o provisionamento dos administradores em ambiente confiável, com `SUPABASE_SERVICE_ROLE_KEY` disponível apenas nesse ambiente de operação.

## 7. Estrutura

```text
src/app/                 Rotas e layouts Next.js
src/actions/              Server Actions de autenticação
src/components/            Componentes compartilhados
src/lib/supabase/          Clientes Supabase browser/server/admin
src/lib/validation/        Validações compartilhadas
supabase/migrations/       Evolução versionada do banco
scripts/                   Provisionamento administrativo
 tests/                    Testes automatizados
```

## Segurança nesta fase

- A role `admin` é atribuída por script privilegiado, nunca pelo browser.
- A tabela `profiles` tem RLS habilitado.
- Usuários autenticados só podem consultar o próprio perfil; administradores podem consultar os perfis.
- Não há política de escrita para `authenticated` em `profiles`.
- O layout protegido valida usuário e role no servidor.
- A service role não deve ser exposta ao cliente.

## Escopo e limitações da Fase 1

Esta entrega é a fundação: login administrativo, dashboard inicial, estrutura de banco para perfis, layout e documentação. Agenda, clientes, contratos, financeiro, estoque e integração Google serão implementados nas fases seguintes. Os indicadores do dashboard são placeholders e não representam dados reais ainda.

Antes de produção, validar domínio, política de convites, SMTP do Supabase, backups do projeto, MFA para administradores e limites de acesso. O provisionamento atual aceita cinco e-mails configurados; a restrição de exatamente cinco contas ativas deve também ser monitorada operacionalmente caso a equipe mude.

## Geração de contratos (Fase 1 — módulo inicial)

A rota `/contratos` gera uma cópia do modelo Google Docs legado e exporta um PDF na mesma pasta do modelo. O modelo original não é modificado. A implementação preserva os marcadores do Apps Script (`{{CLIENTE}}`, `{{CPF}}`, `{{ITENS_PACOTE}}`, `{{VALOR_EXTENSO}}` etc.), a conversão monetária por extenso, os itens condicionais, a cláusula de fogos, os prazos de vencimento/limite e o padrão de nome de arquivo.

### Configurar acesso Google

1. No Google Cloud Console, habilite **Google Docs API** e **Google Drive API**.
2. Crie credenciais OAuth 2.0 para aplicação web/servidor. Autorize a conta Google que possui acesso de edição ao modelo `15ZhmqVluSCaMHWeX9gsuaUoikKrol5e8loB4GrxW08M` e à pasta onde os arquivos devem ser salvos.
3. Gere um refresh token OAuth offline com os escopos `https://www.googleapis.com/auth/drive` e `https://www.googleapis.com/auth/documents`.
4. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REFRESH_TOKEN` no `.env.local` e no ambiente server-side da Vercel. Opcionalmente configure `GOOGLE_CONTRACT_TEMPLATE_ID` para trocar o modelo.
5. Aplique a migration `supabase/migrations/202611020002_contracts.sql` no Supabase.

O refresh token e o segredo OAuth são credenciais privadas: não os coloque em código, repositório, navegador ou variáveis `NEXT_PUBLIC_*`. A conta OAuth precisa ter permissão para copiar o modelo e criar arquivos na pasta de destino. Compartilhe a pasta de contratos com os cinco administradores (ou utilize um Drive compartilhado), pois os arquivos herdam as permissões da pasta. Se o modelo não estiver acessível por essa conta, a geração falhará sem alterar o modelo original.

### Regras operacionais

- Data, cliente, CPF, pacote e local são obrigatórios no formulário; os demais dados pessoais podem ficar vazios, tal como os campos não obrigatórios no modelo.
- Vencimento = data do evento menos 1 dia; limite = data do evento menos 3 dias.
- O formulário mantém os dados após gerar, ao contrário do script que limpava células da aba `Cadastro`.
- O contrato gerado é registrado na tabela `contracts`, incluindo snapshot dos dados, IDs e URLs do Google Docs e PDF. Se o Drive gerar os arquivos e a gravação no banco falhar, os arquivos permanecem no Drive e a interface informa a falha de registro.
- Não foi possível validar a geração real contra o Google Drive nesta execução porque isso depende de credenciais OAuth e permissões da conta Brindare.
