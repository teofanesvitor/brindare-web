-- Baixa automática dos materiais consumíveis quando o evento é marcado como realizado.
-- Taças e mesas são reutilizáveis e não são descontadas.
-- O campo events.fireworks representa pares; o estoque de Fogos é controlado em unidades.

create or replace function public.consume_event_inventory_after_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_item_id uuid;
  v_item_type text;
  v_item_active boolean;
  v_quantity numeric(12,2);
  v_balance numeric(12,2);
  v_item_name text;
begin
  if new.status <> 'Realizado' or old.status = 'Realizado' then
    return new;
  end if;

  if new.event_date > current_date then
    raise exception 'Um evento só pode ser marcado como realizado após a data programada.';
  end if;

  if not public.is_admin() then
    raise exception 'Acesso não autorizado para concluir o evento.';
  end if;

  for v_request in
    select *
    from (values
      ('Fogos', (new.fireworks * 2)::numeric),
      ('Sparkles', new.sparkles::numeric),
      ('Champanhe', new.champagne::numeric)
    ) as requested(item_name, quantity)
    where requested.quantity > 0
  loop
    v_item_name := v_request.item_name;
    v_quantity := v_request.quantity;
    v_item_id := null;
    v_item_type := null;
    v_item_active := false;

    select id, item_type, active
      into v_item_id, v_item_type, v_item_active
    from public.inventory_items
    where lower(name) = lower(v_item_name)
    for update;

    if not found or not v_item_active or v_item_type <> 'consumivel' then
      raise exception 'O item consumível "%" não está cadastrado como ativo no estoque.', v_item_name;
    end if;

    -- Evita baixa duplicada caso o status do evento seja alterado e depois restaurado.
    if exists (
      select 1 from public.inventory_movements
      where event_id = new.id and item_id = v_item_id and movement_type = 'saida'
    ) then
      continue;
    end if;

    select coalesce(sum(case
      when movement_type = 'entrada' then quantity
      when movement_type = 'saida' then -quantity
      else 0
    end), 0)
    into v_balance
    from public.inventory_movements
    where item_id = v_item_id;

    if v_quantity > v_balance then
      raise exception 'Estoque insuficiente de %. Disponível: %, necessário para o evento: %.',
        v_item_name, v_balance, v_quantity;
    end if;

    insert into public.inventory_movements (
      item_id, movement_type, quantity, event_id, description, created_by
    ) values (
      v_item_id, 'saida', v_quantity, new.id,
      'Consumo automático do evento: ' || new.client_name || ' — ' || to_char(new.event_date, 'DD/MM/YYYY'),
      new.created_by
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists events_consume_inventory_after_completion on public.events;
create trigger events_consume_inventory_after_completion
before update of status on public.events
for each row
when (new.status = 'Realizado' and old.status is distinct from new.status)
execute function public.consume_event_inventory_after_completion();
