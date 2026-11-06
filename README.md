# Brindare Web — Fase 1

Fundação do sistema web administrativo da Brindare: Next.js + TypeScript, Supabase Auth/PostgreSQL, layout responsivo e provisionamento seguro de até cinco administradores.

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
- `ADMIN_EMAILS`: de um a cinco e-mails distintos, separados por vírgula.

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

## 3. Provisionar os administradores

Preencha `ADMIN_EMAILS` no `.env.local` com um a cinco endereços reais da equipe. Para o primeiro administrador, configure o e-mail principal da empresa. Em seguida:

```bash
npm run provision:admins
```

O script usa a chave service role somente no processo local, envia convite para os endereços e atribui a role `admin`. Cada pessoa define sua própria senha pelo convite recebido. O script valida de um a cinco e-mails distintos. Não coloque senhas de usuários no código ou no GitHub.

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

Os testes atuais validam a lista de um a cinco administradores (quantidade, duplicidade e formato de e-mail). A cobertura de regras de negócio será ampliada nas fases seguintes.

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

Antes de produção, validar domínio, política de convites, SMTP do Supabase, backups do projeto, MFA para administradores e limites de acesso. O provisionamento atual aceita de um a cinco e-mails configurados; a restrição de exatamente cinco contas ativas deve também ser monitorada operacionalmente caso a equipe mude.

## Geração de contratos

A rota `/contratos` preenche o modelo DOCX oficial armazenado em `src/templates/contract-template.docx`. O arquivo original permanece inalterado. Cada geração cria uma nova cópia DOCX e a armazena no bucket privado `contracts` do Supabase Storage, vinculando o caminho à tabela `contracts`.

### Configuração

1. Copie o modelo DOCX disponibilizado para `src/templates/contract-template.docx`.
2. Aplique as migrations `202611050001_contracts_docx_storage.sql` e `202611060001_contracts_pdf_wordcraft.sql` no Supabase.
3. Construa e publique `services/wordcraft-converter` em um serviço de containers. Configure `WORDCRAFT_CONVERTER_URL` (URL HTTPS) e `WORDCRAFT_CONVERTER_TOKEN` (mesmo segredo do serviço) nas variáveis server-side da Vercel.
4. Sem o conversor configurado, a geração falha de forma explícita e os arquivos temporários são removidos.
5. Não são necessárias credenciais Google nem variáveis OAuth para gerar DOCX/PDF.
6. O bucket é privado; administradores autenticados recebem URLs assinadas com validade de uma hora para DOCX e PDF.

### Marcadores do modelo

`{{CLIENTE}}`, `{{RG}}`, `{{CPF}}`, `{{ENDERECO}}`, `{{TELEFONE}}`, `{{EMAIL}}`, `{{PACOTE}}`, `{{ITENS_PACOTE}}`, `{{DATA}}`, `{{HORARIO}}`, `{{HORARIO_BRINDE}}`, `{{LOCAL}}`, `{{VALOR}}`, `{{VALOR_EXTENSO}}`, `{{ENTRADA}}`, `{{ENTRADA_EXTENSO}}`, `{{RESTANTE}}`, `{{RESTANTE_EXTENSO}}`, `{{DESLOCAMENTO}}`, `{{VENCIMENTO}}`, `{{CLAUSULA_FOGOS}}` e `{{DATA_CONTRATO}}`.

Os itens do pacote são montados a partir das quantidades cadastradas. A cláusula de segurança dos fogos e a linha de deslocamento são removidas quando não se aplicam. O vencimento é calculado como um dia antes do evento. A conversão DOCX → PDF é realizada pelo serviço WordCraft em container separado. O DOCX original e o PDF são armazenados no bucket privado `contracts`, com links assinados por uma hora. Veja `services/wordcraft-converter/README.md` para construir e hospedar o conversor.

### Segurança e histórico

- O bucket `contracts` é privado e aceita apenas arquivos DOCX.
- Os links são assinados por uma hora; o banco armazena o caminho, não uma URL pública.
- Cada geração recebe um nome único e não sobrescreve documentos anteriores.
- As colunas antigas do Google permanecem nullable para preservar o histórico legado.
