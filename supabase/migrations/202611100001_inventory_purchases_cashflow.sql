-- Estoque por tipo de material e compras integradas ao fluxo de caixa.
alter table public.inventory_items
  add column if not exists item_type text not null default 'consumivel'
  check (item_type in ('reutilizavel', 'consumivel'));

update public.inventory_items
set item_type = case
  when lower(name) in ('taças', 'tacas', 'mesa') then 'reutilizavel'
  else 'consumivel'
end;

-- Desativa itens que não fazem parte da operação. Mantém histórico e movimentos antigos.
update public.inventory_items
set active = false
where lower(name) in ('extensão', 'extensao', 'furadeira');

-- Fogos passam a ser controlados por unidade. Converte o histórico lançado em pares.
update public.inventory_movements m
set quantity = quantity * 2
from public.inventory_items i
where m.item_id = i.id
  and lower(i.name) = 'fogos'
  and i.unit = 'par';

update public.inventory_items
set unit = 'unidade', minimum_quantity = 10
where lower(name) = 'fogos';

create table if not exists public.inventory_purchases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(12,2) not null check (quantity > 0),
  total_cents bigint not null check (total_cents > 0),
  purchase_date date not null,
  payment_method text not null check (payment_method in ('Dinheiro','Pix','Débito','Crédito')),
  installments integer not null default 1 check (installments between 1 and 24),
  description text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint inventory_purchases_installment_method_check
    check ((payment_method = 'Crédito') or installments = 1)
);

create table if not exists public.inventory_purchase_installments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.inventory_purchases(id) on delete restrict,
  installment_number integer not null check (installment_number > 0),
  amount_cents bigint not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'prevista' check (status in ('prevista','paga')),
  created_at timestamptz not null default now(),
  unique (purchase_id, installment_number)
);

alter table public.inventory_movements
  add column if not exists purchase_id uuid references public.inventory_purchases(id) on delete set null;

create index if not exists inventory_purchases_date_idx
  on public.inventory_purchases(purchase_date desc);
create index if not exists inventory_purchase_installments_due_idx
  on public.inventory_purchase_installments(due_date, status);

alter table public.inventory_purchases enable row level security;
alter table public.inventory_purchase_installments enable row level security;

create policy "Administradores consultam compras de estoque"
  on public.inventory_purchases for select to authenticated
  using (public.is_admin());
create policy "Administradores consultam parcelas de compras"
  on public.inventory_purchase_installments for select to authenticated
  using (public.is_admin());

create policy "Administradores registram compras de estoque"
  on public.inventory_purchases for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy "Administradores registram parcelas de compras"
  on public.inventory_purchase_installments for insert to authenticated
  with check (
    public.is_admin()
    and exists (
      select 1 from public.inventory_purchases p
      where p.id = purchase_id and p.created_by = auth.uid()
    )
  );

create or replace function public.register_inventory_purchase(
  p_item_id uuid,
  p_quantity numeric,
  p_total_cents bigint,
  p_purchase_date date,
  p_payment_method text,
  p_installments integer default 1,
  p_description text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_user_id uuid := auth.uid();
  v_index integer;
  v_installment_cents bigint;
  v_remainder bigint;
  v_due_date date;
  v_purchase_day integer;
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_total_cents is null or p_total_cents <= 0 then
    raise exception 'Informe quantidade e valor total maiores que zero.';
  end if;
  if p_purchase_date is null then
    raise exception 'Informe a data da compra.';
  end if;
  if p_payment_method not in ('Dinheiro','Pix','Débito','Crédito') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_installments is null or p_installments < 1 or p_installments > 24
     or (p_payment_method <> 'Crédito' and p_installments <> 1) then
    raise exception 'Parcelamento inválido. Apenas compras no crédito podem ter até 24 parcelas.';
  end if;
  if p_total_cents < p_installments then
    raise exception 'O valor total é insuficiente para a quantidade de parcelas.';
  end if;

  perform 1 from public.inventory_items
  where id = p_item_id and active = true
  for update;
  if not found then
    raise exception 'Item de estoque não encontrado ou inativo.';
  end if;

  insert into public.inventory_purchases (
    item_id, quantity, total_cents, purchase_date, payment_method,
    installments, description, created_by
  ) values (
    p_item_id, p_quantity, p_total_cents, p_purchase_date, p_payment_method,
    p_installments, nullif(trim(p_description), ''), v_user_id
  ) returning id into v_purchase_id;

  insert into public.inventory_movements (
    item_id, movement_type, quantity, description, created_by, purchase_id
  ) values (
    p_item_id, 'entrada', p_quantity,
    coalesce(nullif(trim(p_description), ''), 'Compra de estoque'),
    v_user_id, v_purchase_id
  );

  v_installment_cents := p_total_cents / p_installments;
  v_remainder := p_total_cents % p_installments;
  v_purchase_day := least(extract(day from p_purchase_date)::integer, 28);

  for v_index in 1..p_installments loop
    v_due_date := (date_trunc('month', p_purchase_date)::date
      + make_interval(months => v_index - 1)
      + (v_purchase_day - 1) * interval '1 day')::date;

    insert into public.inventory_purchase_installments (
      purchase_id, installment_number, amount_cents, due_date, status
    ) values (
      v_purchase_id, v_index,
      v_installment_cents + case when v_index <= v_remainder then 1 else 0 end,
      v_due_date,
      case when p_payment_method = 'Crédito' then 'prevista' else 'paga' end
    );
  end loop;

  return v_purchase_id;
end;
$$;

grant execute on function public.register_inventory_purchase(uuid,numeric,bigint,date,text,integer,text)
  to authenticated;

alter table public.inventory_purchase_installments
  add column if not exists paid_at date;

create policy "Administradores atualizam parcelas de compras"
  on public.inventory_purchase_installments for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.mark_inventory_purchase_installment_paid(p_installment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;
  update public.inventory_purchase_installments
  set status = 'paga', paid_at = current_date
  where id = p_installment_id and status = 'prevista';
  if not found then
    raise exception 'Parcela não encontrada ou já quitada.';
  end if;
end;
$$;

grant execute on function public.mark_inventory_purchase_installment_paid(uuid) to authenticated;
