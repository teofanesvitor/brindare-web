-- Migração da geração de contratos para DOCX privado no Supabase Storage.
-- Colunas Google antigas permanecem nullable para preservar o histórico legado.
alter table public.contracts add column if not exists docx_path text;
alter table public.contracts
  alter column google_document_id drop not null,
  alter column google_document_url drop not null,
  alter column google_pdf_id drop not null,
  alter column google_pdf_url drop not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 10485760,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can read own contract files" on storage.objects;
create policy "Admins can read own contract files" on storage.objects for select to authenticated
  using (bucket_id = 'contracts' and public.is_admin());
drop policy if exists "Admins can upload own contract files" on storage.objects;
create policy "Admins can upload own contract files" on storage.objects for insert to authenticated
  with check (bucket_id = 'contracts' and public.is_admin());
drop policy if exists "Admins can delete own contract files" on storage.objects;
create policy "Admins can delete own contract files" on storage.objects for delete to authenticated
  using (bucket_id = 'contracts' and public.is_admin());
