-- Separa retiradas de lucro das despesas operacionais sem perder o registro de caixa.
alter table public.financial_expenses
  drop constraint if exists financial_expenses_category_check;

alter table public.financial_expenses
  add constraint financial_expenses_category_check check (category = any (array[
    'Transporte','Combustível','Manutenção','Mão de obra','Serviços terceirizados',
    'Materiais','Administrativo','Impostos e taxas','Outros','Retirada de lucro'
  ]));

update public.financial_expenses
set category = 'Retirada de lucro',
    notes = concat_ws(' | ', nullif(notes, ''), 'Classificado como retirada de lucro; permanece como saída de caixa, fora das despesas operacionais.')
where id = '5411cfe2-0ea5-4c56-9d84-8a6977e31d7d'
  and description = 'Pagamento equipe'
  and amount_cents = 400000
  and category = 'Mão de obra';

create or replace view public.financial_cashflow_monthly
with (security_invoker = true)
as
with income as (
  select date_trunc('month', paid_at)::date as month_start,
         sum(amount_cents)::bigint as revenue_cents
  from public.event_payments group by 1
),
inventory_paid as (
  select date_trunc('month', coalesce(i.paid_at, i.due_date))::date as month_start,
         sum(i.amount_cents)::bigint as amount_cents
  from public.inventory_purchase_installments i where i.status = 'paga' group by 1
),
other_paid as (
  select date_trunc('month', paid_at)::date as month_start,
         sum(amount_cents)::bigint as amount_cents,
         sum(amount_cents) filter (where category <> 'Retirada de lucro')::bigint as operating_amount_cents,
         sum(amount_cents) filter (where category = 'Retirada de lucro')::bigint as withdrawals_cents
  from public.financial_expenses
  where status = 'paga' and paid_at is not null group by 1
),
planned_inventory as (
  select date_trunc('month', due_date)::date as month_start, sum(amount_cents)::bigint as amount_cents
  from public.inventory_purchase_installments where status = 'prevista' group by 1
),
planned_other as (
  select date_trunc('month', due_date)::date as month_start,
         sum(amount_cents)::bigint as amount_cents,
         sum(amount_cents) filter (where category = 'Retirada de lucro')::bigint as planned_withdrawals_cents
  from public.financial_expenses where status = 'prevista' group by 1
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
       (coalesce(pi.amount_cents, 0) + coalesce(po.amount_cents, 0))::bigint as planned_expenses_cents,
       (coalesce(ip.amount_cents, 0) + coalesce(op.operating_amount_cents, 0))::bigint as paid_operating_expenses_cents,
       coalesce(op.withdrawals_cents, 0)::bigint as paid_withdrawals_cents,
       coalesce(po.planned_withdrawals_cents, 0)::bigint as planned_withdrawals_cents
from all_months m
left join income inc using (month_start)
left join inventory_paid ip using (month_start)
left join other_paid op using (month_start)
left join planned_inventory pi using (month_start)
left join planned_other po using (month_start);

grant select on public.financial_cashflow_monthly to authenticated;
