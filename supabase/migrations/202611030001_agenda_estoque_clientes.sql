-- Brindare Web: agenda, clientes, solicitações públicas e estoque.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  cpf text,
  rg text,
  phone text,
  email text,
  address text,
  neighborhood text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clients_cpf_unique on public.clients(cpf) where cpf is not null and cpf <> '';

create table if not exists public.client_intakes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','submitted','converted','expired')),
  payload jsonb,
  client_id uuid references public.clients(id) on delete set null,
  expires_at timestamptz not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  event_date date not null,
  event_time time,
  venue text not null,
  ceremony_contact text,
  referral text,
  package_name text not null,
  total_cents bigint not null default 0 check (total_cents >= 0),
  deposit_cents bigint not null default 0 check (deposit_cents >= 0),
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  status text not null default 'A pagar' check (status in ('A pagar','Confirmado','Pago','Realizado','Cancelado')),
  glasses integer not null default 0 check (glasses >= 0),
  fireworks integer not null default 0 check (fireworks >= 0),
  sparkles integer not null default 0 check (sparkles >= 0),
  tables integer not null default 0 check (tables >= 0),
  champagne integer not null default 0 check (champagne >= 0),
  travel_cents bigint not null default 0 check (travel_cents >= 0),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_date_idx on public.events(event_date);
create index if not exists events_status_idx on public.events(status);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null default 'unidade',
  minimum_quantity numeric(12,2) not null default 0 check (minimum_quantity >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('entrada','saida','ajuste')),
  quantity numeric(12,2) not null check (quantity > 0),
  event_id uuid references public.events(id) on delete set null,
  description text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_item_idx on public.inventory_movements(item_id, created_at desc);

alter table public.clients enable row level security;
alter table public.client_intakes enable row level security;
alter table public.events enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy "Administradores gerenciam clientes" on public.clients for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Administradores consultam solicitações" on public.client_intakes for select to authenticated
using (public.is_admin());
create policy "Administradores gerenciam solicitações" on public.client_intakes for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Administradores criam solicitações" on public.client_intakes for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());
create policy "Administradores gerenciam eventos" on public.events for all to authenticated
using (public.is_admin()) with check (public.is_admin() and created_by = auth.uid());
create policy "Administradores gerenciam itens de estoque" on public.inventory_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Administradores gerenciam movimentações" on public.inventory_movements for all to authenticated
using (public.is_admin()) with check (public.is_admin() and created_by = auth.uid());

insert into public.inventory_items(name, unit, minimum_quantity) values
  ('Taças','unidade',30),('Fogos','par',2),('Sparkles','unidade',10),
  ('Mesa','unidade',1),('Champanhe','garrafa',2),('Extensão','unidade',1),
  ('Furadeira','unidade',1)
on conflict (name) do nothing;

comment on table public.client_intakes is 'Solicitações públicas identificadas por token SHA-256; o token original nunca é armazenado.';
