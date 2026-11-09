-- Hardening para operação multiadministrador, estoque concorrente e arquivos assinados.
-- Migration aditiva: não altera migrations já aplicadas.

-- Todos os administradores podem atualizar qualquer evento; a autoria permanece no campo created_by.
drop policy if exists "Administradores gerenciam eventos" on public.events;
drop policy if exists "Administradores consultam eventos" on public.events;
drop policy if exists "Administradores criam eventos" on public.events;
drop policy if exists "Administradores atualizam eventos" on public.events;
drop policy if exists "Administradores excluem eventos" on public.events;

create policy "Administradores consultam eventos"
  on public.events for select to authenticated
  using (public.is_admin());
create policy "Administradores criam eventos"
  on public.events for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
create policy "Administradores atualizam eventos"
  on public.events for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy "Administradores excluem eventos"
  on public.events for delete to authenticated
  using (public.is_admin());

-- O bucket privado aceita os formatos efetivamente aceitos pela aplicação.
update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'image/jpeg',
      'image/png'
    ]
where id = 'contracts';

-- Serializa movimentações por item para impedir saldo negativo em saídas concorrentes.
create or replace function public.register_inventory_movement(
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_description text default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_balance numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;
  if p_movement_type not in ('entrada', 'saida') then
    raise exception 'Tipo de movimentação inválido.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;

  perform 1 from public.inventory_items where id = p_item_id and active = true for update;
  if not found then
    raise exception 'Item de estoque não encontrado ou inativo.';
  end if;

  select coalesce(sum(case
    when movement_type = 'entrada' then quantity
    when movement_type = 'saida' then -quantity
    else 0
  end), 0)
  into v_balance
  from public.inventory_movements
  where item_id = p_item_id;

  if p_movement_type = 'saida' and p_quantity > v_balance then
    raise exception 'Saldo insuficiente. Disponível: %.', v_balance;
  end if;

  insert into public.inventory_movements (
    item_id, movement_type, quantity, description, created_by
  ) values (
    p_item_id, p_movement_type, p_quantity,
    nullif(trim(p_description), ''), auth.uid()
  );
end;
$$;

grant execute on function public.register_inventory_movement(uuid, text, numeric, text) to authenticated;

-- Registra contrato e evento na mesma transação. Se qualquer INSERT falhar, ambos são revertidos.
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
    file_name, input_snapshot, status
  ) values (
    auth.uid(),
    p_contract->>'client_name',
    (p_contract->>'event_date')::date,
    p_contract->>'package_name',
    (p_contract->>'total_cents')::bigint,
    (p_contract->>'deposit_cents')::bigint,
    (p_contract->>'balance_cents')::bigint,
    p_contract->>'docx_path',
    p_contract->>'file_name',
    p_contract->'input_snapshot',
    coalesce(p_contract->>'status', 'generated')
  ) returning id into v_contract_id;

  insert into public.events (
    contract_id, client_id, client_name, event_date, event_time,
    venue, package_name, total_cents, deposit_cents, balance_cents,
    travel_cents, status, glasses, fireworks, sparkles, tables,
    champagne, created_by
  ) values (
    v_contract_id,
    nullif(p_event->>'client_id', '')::uuid,
    p_event->>'client_name',
    (p_event->>'event_date')::date,
    nullif(p_event->>'event_time', '')::time,
    p_event->>'venue',
    p_event->>'package_name',
    (p_event->>'total_cents')::bigint,
    (p_event->>'deposit_cents')::bigint,
    (p_event->>'balance_cents')::bigint,
    (p_event->>'travel_cents')::bigint,
    coalesce(p_event->>'status', 'A pagar'),
    (p_event->>'glasses')::integer,
    (p_event->>'fireworks')::integer,
    (p_event->>'sparkles')::integer,
    (p_event->>'tables')::integer,
    (p_event->>'champagne')::integer,
    auth.uid()
  );

  return v_contract_id;
end;
$$;

grant execute on function public.create_contract_and_event(jsonb, jsonb) to authenticated;
