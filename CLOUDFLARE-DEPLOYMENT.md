# Cloudflare Workers — ambiente de teste

Esta branch prepara uma implantação de teste do Brindare Web na Cloudflare Workers usando o adaptador OpenNext. A branch `main` não é modificada.

## Estado

- [x] Branch isolada baseada em `feat/agenda-operational-improvements`.
- [x] Configuração inicial do OpenNext e Wrangler.
- [x] Configuração Node.js compatível com APIs utilizadas pelo gerador DOCX.
- [ ] Regenerar `package-lock.json` com `npm install`.
- [ ] Executar typecheck, testes, lint e build Next.js.
- [ ] Executar build e preview OpenNext no runtime Workers.
- [ ] Corrigir incompatibilidades detectadas.
- [ ] Configurar variáveis e secrets na conta Cloudflare.
- [ ] Publicar somente no subdomínio de teste `workers.dev`.

## Dependências

O adaptador OpenNext está fixado em `1.20.16`. O Next.js e o eslint-config-next foram atualizados para a série `15.5.29+`, que atende ao requisito mínimo de segurança da versão atual do adaptador. Wrangler está na série 4.

Após atualizar as dependências, execute:

```bash
npm install
npm run typecheck
npm test
npm run lint
npm run build
npm run preview
```

O comando `preview` compila o projeto com OpenNext e inicia o runtime local do Workers. Ele é o teste decisivo antes de qualquer deploy.

## Variáveis de ambiente

Configurar no ambiente de teste, sem gravar valores neste repositório:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` — usar a URL de teste `https://brindare-web-test.<subdominio>.workers.dev` depois que o subdomínio for definido.
- `SUPABASE_SERVICE_ROLE_KEY` — secret privado, somente se as operações server-side que usam `createAdminClient()` forem mantidas.

Não utilizar prefixo `NEXT_PUBLIC_` na service role. Não adicionar credenciais Google, Supabase ou tokens ao GitHub.

## Limites e custo

A implantação deve permanecer no plano gratuito da Cloudflare. Não habilitar Workers Paid, R2 pago, domínio próprio pago ou outros serviços com cobrança. Antes de publicar, conferir no painel da Cloudflare que o Worker está no plano Free e revisar os limites atuais.

O Supabase permanece separado e deve estar no plano Free. Projetos Supabase Free podem ser pausados por inatividade e não oferecem backup automático; isso deve ser aceito conscientemente antes do uso com dados reais.

## Observações técnicas

- O modelo DOCX é incluído pelo `outputFileTracingIncludes` já existente. A leitura por `node:fs/promises` precisa ser validada no preview Workers.
- O tamanho máximo de upload precisa ser alinhado entre Server Actions, validação de formulário e bucket Supabase.
- Não há conversão PDF incluída nesta preparação. O fluxo DOCX existente será testado sem introduzir serviço externo.
- Nenhum deploy de produção será realizado por esta branch.
