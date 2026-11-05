-- Registro financeiro por evento: o status é calculado a partir dos pagamentos efetivamente registrados.
create table if not exists public.event_payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  paid_at date not null default current_date,
  payment_method text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.events
  add column if not exists payment_status text not null default 'A pagar'
  check (payment_status in ('A pagar','Confirmado','Pago'));

create index if not exists event_payments_event_paid_at_idx
  on public.event_payments(event_id, paid_at desc);

alter table public.event_payments enable row level security;
create policy "Administradores consultam pagamentos de eventos"
  on public.event_payments for select to authenticated
  using (public.is_admin());
create policy "Administradores registram pagamentos de eventos"
  on public.event_payments for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());

-- A trava na linha do evento evita dois lançamentos simultâneos ultrapassarem o valor contratado.
create or replace function public.register_event_payment(
  p_event_id uuid,
  p_amount_cents bigint,
  p_paid_at date,
  p_payment_method text default null,
  p_notes text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_paid_before bigint;
  v_paid_after bigint;
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'O valor do pagamento deve ser maior que zero.';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Evento não encontrado.';
  end if;
  if v_event.status = 'Cancelado' then
    raise exception 'Não é possível registrar pagamento em evento cancelado.';
  end if;

  select coalesce(sum(amount_cents), 0) into v_paid_before
  from public.event_payments
  where event_id = p_event_id;

  v_paid_after := v_paid_before + p_amount_cents;
  if v_paid_after > v_event.total_cents then
    raise exception 'O pagamento excede o saldo em aberto de R$ %.',
      to_char((v_event.total_cents - v_paid_before)::numeric / 100, 'FM999999990D00');
  end if;

  insert into public.event_payments (
    event_id, amount_cents, paid_at, payment_method, notes, created_by
  ) values (
    p_event_id, p_amount_cents, coalesce(p_paid_at, current_date),
    nullif(trim(p_payment_method), ''), nullif(trim(p_notes), ''), auth.uid()
  );

  if v_paid_after >= v_event.total_cents then
    update public.events set payment_status = 'Pago', updated_at = now() where id = p_event_id;
  elsif v_paid_after >= v_event.deposit_cents and v_event.deposit_cents > 0 then
    update public.events set payment_status = 'Confirmado', updated_at = now() where id = p_event_id;
  elsif v_paid_after > 0 and v_event.deposit_cents = 0 then
    update public.events set payment_status = 'Confirmado', updated_at = now() where id = p_event_id;
  else
    update public.events set payment_status = 'A pagar', updated_at = now() where id = p_event_id;
  end if;
end;
$$;

grant execute on function public.register_event_payment(uuid, bigint, date, text, text) to authenticated;
