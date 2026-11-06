-- Adiciona o PDF gerado pelo WordCraft sem remover o DOCX editável.
alter table public.contracts add column if not exists pdf_path text;

-- O bucket permanece privado. Aceita DOCX e PDF e limita cada objeto a 20 MB.
update storage.buckets
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf'
    ]
where id = 'contracts';
