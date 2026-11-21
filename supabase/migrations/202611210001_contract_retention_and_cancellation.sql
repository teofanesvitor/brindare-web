-- Retenção de DOCX, reemissão de contratos e cancelamento com preservação financeira.

-- Mantém a data de geração do arquivo separada da criação do registro.
alter table public.contracts
  add column if not exists docx_created_at timestamptz;

update public.contracts
set docx_created_at = created_at
where docx_path is not null and docx_created_at is null;

-- Pagamentos sobrevivem à exclusão do evento. O snapshot permite identificar
-- a origem do recebimento mesmo depois que o evento deixa de existir.
alter table public.event_payments
  add column if not exists event_client_name text,
  add column if not exists event_date date;

alter table public.event_payments
  drop constraint if exists event_payments_event_id_fkey;

alter table public.event_payments
  alter column event_id drop not null;

alter table public.event_payments
  add constraint event_payments_event_id_fkey
  foreign key (event_id) references public.events(id) on delete set null;

-- Reemite o contrato e atualiza o evento vinculado, sem criar outro evento
-- nem apagar pagamentos já recebidos.
create or replace function public.update_contract_and_event(
  p_contract_id uuid,
  p_contract jsonb,
  p_event jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_received bigint;
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;

  perform 1 from public.contracts where id = p_contract_id for update;
  if not found then
    raise exception 'Contrato não encontrado.';
  end if;

  select * into v_event
  from public.events
  where contract_id = p_contract_id
  for update;

  if not found then
    raise exception 'Evento vinculado ao contrato não encontrado.';
  end if;
  if v_event.status in ('Realizado', 'Cancelado') then
    raise exception 'Não é possível refazer um contrato de evento realizado ou cancelado.';
  end if;

  select coalesce(sum(amount_cents), 0)
    into v_received
  from public.event_payments
  where event_id = v_event.id;

  if v_received > (p_event->>'total_cents')::bigint then
    raise exception 'O novo valor total é inferior aos pagamentos já registrados.';
  end if;

  update public.contracts set
    client_name = p_contract->>'client_name',
    event_date = (p_contract->>'event_date')::date,
    package_name = p_contract->>'package_name',
    total_cents = (p_contract->>'total_cents')::bigint,
    deposit_cents = (p_contract->>'deposit_cents')::bigint,
    balance_cents = (p_contract->>'balance_cents')::bigint,
    docx_path = p_contract->>'docx_path',
    docx_created_at = now(),
    file_name = p_contract->>'file_name',
    input_snapshot = p_contract->'input_snapshot',
    status = 'generated'
  where id = p_contract_id;

  update public.events set
    client_id = nullif(p_event->>'client_id', '')::uuid,
    client_name = p_event->>'client_name',
    event_date = (p_event->>'event_date')::date,
    event_time = nullif(p_event->>'event_time', '')::time,
    toast_time = nullif(p_event->>'toast_time', '')::time,
    venue = p_event->>'venue',
    package_name = p_event->>'package_name',
    total_cents = (p_event->>'total_cents')::bigint,
    deposit_cents = (p_event->>'deposit_cents')::bigint,
    balance_cents = (p_event->>'balance_cents')::bigint,
    travel_cents = (p_event->>'travel_cents')::bigint,
    glasses = (p_event->>'glasses')::integer,
    fireworks = (p_event->>'fireworks')::integer,
    sparkles = (p_event->>'sparkles')::integer,
    tables = (p_event->>'tables')::integer,
    champagne = (p_event->>'champagne')::integer,
    payment_status = case
      when v_received >= (p_event->>'total_cents')::bigint then 'Pago'
      when v_received >= (p_event->>'deposit_cents')::bigint and (p_event->>'deposit_cents')::bigint > 0 then 'Confirmado'
      when v_received > 0 and (p_event->>'deposit_cents')::bigint = 0 then 'Confirmado'
      else 'A pagar'
    end,
    updated_at = now()
  where id = v_event.id;
end;
$$;

grant execute on function public.update_contract_and_event(uuid, jsonb, jsonb) to authenticated;

-- Cancela removendo o evento e o contrato operacional. Pagamentos ficam na
-- tabela financeira, agora sem FK para o evento e com identificação histórica.
create or replace function public.cancel_event_and_preserve_payments(
  p_event_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Evento não encontrado.';
  end if;
  if v_event.status = 'Realizado' then
    raise exception 'Um evento realizado não pode ser cancelado por esta operação.';
  end if;

  update public.event_payments
  set event_client_name = v_event.client_name,
      event_date = v_event.event_date,
      event_id = null
  where event_id = p_event_id;

  delete from public.event_signed_contracts where event_id = p_event_id;
  delete from public.events where id = p_event_id;

  if v_event.contract_id is not null then
    delete from public.contracts where id = v_event.contract_id;
  end if;
end;
$$;

grant execute on function public.cancel_event_and_preserve_payments(uuid) to authenticated;


-- Mantém a criação de contrato e evento em uma única transação, incluindo
-- o horário do brinde e a data de geração do DOCX.
create or replace function public.create_contract_and_event(
  p_contract jsonb,
  p_event jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_contract_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;
  if p_contract->>'created_by' is distinct from auth.uid()::text
     or p_event->>'created_by' is distinct from auth.uid()::text then
    raise exception 'Usuário criador inválido.';
  end if;

  insert into public.contracts (
    created_by, client_name, event_date, package_name,
    total_cents, deposit_cents, balance_cents, docx_path,
    docx_created_at, file_name, input_snapshot, status
  ) values (
    auth.uid(), p_contract->>'client_name', (p_contract->>'event_date')::date,
    p_contract->>'package_name', (p_contract->>'total_cents')::bigint,
    (p_contract->>'deposit_cents')::bigint, (p_contract->>'balance_cents')::bigint,
    p_contract->>'docx_path', now(), p_contract->>'file_name',
    p_contract->'input_snapshot', coalesce(p_contract->>'status', 'generated')
  ) returning id into v_contract_id;

  insert into public.events (
    contract_id, client_id, client_name, event_date, event_time, toast_time,
    venue, package_name, total_cents, deposit_cents, balance_cents,
    travel_cents, status, glasses, fireworks, sparkles, tables,
    champagne, created_by
  ) values (
    v_contract_id, nullif(p_event->>'client_id', '')::uuid,
    p_event->>'client_name', (p_event->>'event_date')::date,
    nullif(p_event->>'event_time', '')::time, nullif(p_event->>'toast_time', '')::time,
    p_event->>'venue', p_event->>'package_name',
    (p_event->>'total_cents')::bigint, (p_event->>'deposit_cents')::bigint,
    (p_event->>'balance_cents')::bigint, (p_event->>'travel_cents')::bigint,
    coalesce(p_event->>'status', 'A pagar'), (p_event->>'glasses')::integer,
    (p_event->>'fireworks')::integer, (p_event->>'sparkles')::integer,
    (p_event->>'tables')::integer, (p_event->>'champagne')::integer, auth.uid()
  );

  return v_contract_id;
end;
$$;

grant execute on function public.create_contract_and_event(jsonb, jsonb) to authenticated;


-- Recupera vínculos de eventos cancelados antigos criados antes da relação
-- contract_id existir, usando cliente, data e pacote como correspondência.
update public.events e
set contract_id = (
  select c.id
  from public.contracts c
  where lower(trim(c.client_name)) = lower(trim(e.client_name))
    and c.event_date = e.event_date
    and c.package_name = e.package_name
    and not exists (
      select 1 from public.events linked where linked.contract_id = c.id
    )
  order by abs(extract(epoch from (c.created_at - e.created_at)))
  limit 1
)
where e.status = 'Cancelado'
  and e.contract_id is null
  and exists (
    select 1 from public.contracts c
    where lower(trim(c.client_name)) = lower(trim(e.client_name))
      and c.event_date = e.event_date
      and c.package_name = e.package_name
  );

-- Remove contratos marcados como cancelados que não possuam mais evento vinculado.
-- Retorna os caminhos para que a aplicação também apague os arquivos no Storage.
create or replace function public.purge_orphan_cancelled_contracts()
returns table(docx_path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;

  return query
  delete from public.contracts c
  where c.status = 'cancelled'
    and not exists (
      select 1 from public.events e where e.contract_id = c.id
    )
  returning c.docx_path;
end;
$$;

grant execute on function public.purge_orphan_cancelled_contracts() to authenticated;
