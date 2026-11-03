create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  client_name text not null,
  event_date date not null,
  package_name text not null,
  total_cents bigint not null check (total_cents >= 0),
  deposit_cents bigint not null check (deposit_cents >= 0),
  balance_cents bigint not null check (balance_cents >= 0),
  google_document_id text not null,
  google_document_url text not null,
  google_pdf_id text not null,
  google_pdf_url text not null,
  file_name text not null,
  input_snapshot jsonb not null,
  status text not null default 'generated' check (status in ('generated', 'cancelled', 'error')),
  created_at timestamptz not null default now()
);

create index if not exists contracts_event_date_idx on public.contracts(event_date desc);
create index if not exists contracts_created_at_idx on public.contracts(created_at desc);

alter table public.contracts enable row level security;
create policy "Administradores consultam contratos"
  on public.contracts for select to authenticated
  using (public.is_admin());
create policy "Administradores criam contratos"
  on public.contracts for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy "Administradores atualizam contratos"
  on public.contracts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
