-- Gestão financeira gerencial: despesas operacionais, saldo inicial e consolidação mensal.
create table if not exists public.financial_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (length(trim(description)) >= 2),
  category text not null check (category in (
    'Transporte','Combustível','Manutenção','Mão de obra','Serviços terceirizados',
    'Materiais','Administrativo','Impostos e taxas','Outros'
  )),
  amount_cents bigint not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'prevista' check (status in ('prevista','paga')),
  paid_at date,
  payment_method text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint financial_expenses_paid_date_check check (
    (status = 'paga' and paid_at is not null) or
    (status = 'prevista' and paid_at is null)
  )
);

create index if not exists financial_expenses_due_idx on public.financial_expenses(due_date, status);
create index if not exists financial_expenses_paid_idx on public.financial_expenses(paid_at) where status = 'paga';

alter table public.financial_expenses enable row level security;
drop policy if exists "Administradores consultam despesas financeiras" on public.financial_expenses;
drop policy if exists "Administradores registram despesas financeiras" on public.financial_expenses;
drop policy if exists "Administradores atualizam despesas financeiras" on public.financial_expenses;
drop policy if exists "Administradores excluem despesas financeiras" on public.financial_expenses;

create policy "Administradores consultam despesas financeiras"
  on public.financial_expenses for select to authenticated using (public.is_admin());
create policy "Administradores registram despesas financeiras"
  on public.financial_expenses for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy "Administradores atualizam despesas financeiras"
  on public.financial_expenses for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "Administradores excluem despesas financeiras"
  on public.financial_expenses for delete to authenticated using (public.is_admin());

create table if not exists public.financial_settings (
  id boolean primary key default true check (id = true),
  opening_balance_cents bigint not null default 0 check (opening_balance_cents >= 0),
  opening_balance_date date not null default current_date,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.financial_settings enable row level security;
drop policy if exists "Administradores consultam configuração financeira" on public.financial_settings;
drop policy if exists "Administradores alteram configuração financeira" on public.financial_settings;
create policy "Administradores consultam configuração financeira"
  on public.financial_settings for select to authenticated using (public.is_admin());
create policy "Administradores alteram configuração financeira"
  on public.financial_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.financial_settings(id, opening_balance_cents, opening_balance_date)
values (true, 0, current_date)
on conflict (id) do nothing;

-- Corrige compras à vista antigas: status pago deve possuir data efetiva de saída.
update public.inventory_purchase_installments i
set paid_at = p.purchase_date
from public.inventory_purchases p
where p.id = i.purchase_id and i.status = 'paga' and i.paid_at is null;

-- Consolidação mensal sem limite artificial de 500/1000 registros na aplicação.
create or replace view public.financial_cashflow_monthly
with (security_invoker = true)
as
with income as (
  select date_trunc('month', paid_at)::date as month_start,
         sum(amount_cents)::bigint as revenue_cents
  from public.event_payments
  group by 1
),
inventory_paid as (
  select date_trunc('month', coalesce(i.paid_at, i.due_date))::date as month_start,
         sum(i.amount_cents)::bigint as amount_cents
  from public.inventory_purchase_installments i
  where i.status = 'paga'
  group by 1
),
other_paid as (
  select date_trunc('month', paid_at)::date as month_start,
         sum(amount_cents)::bigint as amount_cents
  from public.financial_expenses
  where status = 'paga' and paid_at is not null
  group by 1
),
planned_inventory as (
  select date_trunc('month', due_date)::date as month_start,
         sum(amount_cents)::bigint as amount_cents
  from public.inventory_purchase_installments
  where status = 'prevista'
  group by 1
),
planned_other as (
  select date_trunc('month', due_date)::date as month_start,
         sum(amount_cents)::bigint as amount_cents
  from public.financial_expenses
  where status = 'prevista'
  group by 1
),
all_months as (
  select month_start from income
  union select month_start from inventory_paid
  union select month_start from other_paid
  union select month_start from planned_inventory
  union select month_start from planned_other
)
select m.month_start,
       coalesce(inc.revenue_cents, 0)::bigint as revenue_cents,
       (coalesce(ip.amount_cents, 0) + coalesce(op.amount_cents, 0))::bigint as paid_expenses_cents,
       (coalesce(pi.amount_cents, 0) + coalesce(po.amount_cents, 0))::bigint as planned_expenses_cents
from all_months m
left join income inc using (month_start)
left join inventory_paid ip using (month_start)
left join other_paid op using (month_start)
left join planned_inventory pi using (month_start)
left join planned_other po using (month_start);

grant select on public.financial_cashflow_monthly to authenticated;

create or replace view public.financial_receivables_summary
with (security_invoker = true)
as
with received as (
  select event_id, sum(amount_cents)::bigint as received_cents
  from public.event_payments
  group by event_id
)
select count(*) filter (where greatest(e.total_cents - coalesce(r.received_cents, 0), 0) > 0)::bigint as open_events,
       coalesce(sum(greatest(e.total_cents - coalesce(r.received_cents, 0), 0)), 0)::bigint as receivable_cents
from public.events e
left join received r on r.event_id = e.id
where e.status <> 'Cancelado';

grant select on public.financial_receivables_summary to authenticated;

create or replace view public.financial_payables_summary
with (security_invoker = true)
as
with payables as (
  select amount_cents, due_date, status from public.inventory_purchase_installments
  union all
  select amount_cents, due_date, status from public.financial_expenses
)
select coalesce(sum(amount_cents) filter (where status = 'prevista'), 0)::bigint as pending_cents,
       coalesce(sum(amount_cents) filter (where status = 'prevista' and due_date < current_date), 0)::bigint as overdue_cents
from payables;

grant select on public.financial_payables_summary to authenticated;
