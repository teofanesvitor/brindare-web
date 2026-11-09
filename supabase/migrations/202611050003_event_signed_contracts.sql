-- Arquivos de contratos assinados: mantém o DOCX original e cada versão assinada separadamente.
create table if not exists public.event_signed_contracts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  storage_path text not null unique,
  original_file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  signed_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists event_signed_contracts_event_signed_at_idx
  on public.event_signed_contracts(event_id, signed_at desc);

alter table public.event_signed_contracts enable row level security;

create policy "Administradores consultam contratos assinados"
  on public.event_signed_contracts for select to authenticated
  using (public.is_admin());

create policy "Administradores registram contratos assinados"
  on public.event_signed_contracts for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());

-- Os arquivos usam o bucket privado contracts já utilizado pelos DOCX gerados.
