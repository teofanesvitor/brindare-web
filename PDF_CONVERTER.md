
## Conversão DOCX para PDF

A geração original do DOCX permanece inalterada. Após gerar o DOCX, o servidor chama a função Python em `/api/docx_to_pdf`, que usa `python-docx` e `reportlab`, e armazena o PDF no mesmo bucket privado `contracts`.

### Configuração
- Adicione `CONVERTER_SECRET` como variável de ambiente no projeto Vercel (mesmo valor usado pela função Python).
- A função Python exige autenticação por cabeçalho interno e aceita DOCX de até 4,3 MB.
- O runtime Python da Vercel instala as dependências de `requirements.txt`.
- Em desenvolvimento local, execute com `vercel dev` para disponibilizar simultaneamente a aplicação Next.js e a função Python.

O conversor recria o layout suportado pelo script Python. Cabeçalhos/rodapés, caixas de texto, equações, campos e notas de rodapé não são reproduzidos; revise os PDFs reais antes de usar contratos com clientes.
