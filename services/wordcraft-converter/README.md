# WordCraft DOCX → PDF converter

Serviço HTTP interno que executa o `wordcraft-cli convert input.docx output.pdf`. O CLI é distribuído pelo projeto WordCraft e exporta PDF sem abrir interface gráfica.

## Executar com Docker

```bash
docker build -t brindare-wordcraft-converter services/wordcraft-converter
docker run --rm -p 8080:8080 \
  -e WORDCRAFT_CONVERTER_TOKEN="gere-um-segredo-aleatorio-longo" \
  brindare-wordcraft-converter
```

A imagem instala WordCraft CLI 0.16.0. Para atualizar, passe `--build-arg WORDCRAFT_VERSION=x.y.z` e valide a versão publicada em https://github.com/storytold/wordcraft/releases.

## API

- `GET /health`: verificação sem expor segredo.
- `POST /convert`: corpo binário DOCX, `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`, autenticação `Authorization: Bearer <token>`; retorna `application/pdf`.
- Limite: 10 MB; timeout do processo: 45 s; diretório temporário removido ao final.

O serviço não persiste arquivos, não registra o conteúdo do contrato e deve ficar em rede privada ou atrás de HTTPS. Use um token aleatório exclusivo e não o reutilize como chave Supabase. Não exponha a porta publicamente sem TLS, autenticação e rate limit no proxy.

## Deploy

Hospede este serviço em container (por exemplo, Railway, Render ou Fly.io). Configure no serviço:
- `WORDCRAFT_CONVERTER_TOKEN`: segredo forte aleatório.
- Porta HTTP: 8080.

No Next.js configure `WORDCRAFT_CONVERTER_URL` com a URL HTTPS do serviço e `WORDCRAFT_CONVERTER_TOKEN` com o mesmo segredo. O endpoint é chamado exclusivamente no servidor.
