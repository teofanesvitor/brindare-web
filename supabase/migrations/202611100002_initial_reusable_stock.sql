-- Saldos iniciais e estoques mínimos dos materiais reutilizáveis.
-- Estado físico confirmado pelo operador: Mesa = 2; Taças = 90.
-- Estoque mínimo: Mesa = 1; Taças = 30.

do $$
declare
  v_admin_id uuid;
  v_mesa_id uuid;
  v_tacas_id uuid;
begin
  select id into v_admin_id
  from public.profiles
  where role = 'admin'
  order by created_at
  limit 1;

  if v_admin_id is null then
    raise exception 'Nenhum administrador encontrado em public.profiles; não foi possível registrar os saldos iniciais.';
  end if;

  select id into v_mesa_id
  from public.inventory_items
  where lower(name) = 'mesa' and active = true;

  select id into v_tacas_id
  from public.inventory_items
  where lower(name) in ('taças', 'tacas') and active = true;

  if v_mesa_id is null or v_tacas_id is null then
    raise exception 'Não foi possível localizar os itens ativos Mesa e Taças. Nenhuma alteração foi concluída.';
  end if;

  -- Estes valores representam a contagem física atual. Não somar sobre movimentos prévios.
  if exists (
    select 1 from public.inventory_movements
    where item_id in (v_mesa_id, v_tacas_id)
  ) then
    raise exception 'Mesa ou Taças já possuem movimentações. Verifique o histórico antes de lançar saldos iniciais para evitar duplicidade.';
  end if;

  update public.inventory_items
  set minimum_quantity = case
    when id = v_mesa_id then 1
    when id = v_tacas_id then 30
  end
  where id in (v_mesa_id, v_tacas_id);

  insert into public.inventory_movements (
    item_id, movement_type, quantity, description, created_by
  ) values
    (v_mesa_id, 'entrada', 2, 'Saldo inicial — inventário físico', v_admin_id),
    (v_tacas_id, 'entrada', 90, 'Saldo inicial — inventário físico', v_admin_id);
end
$$;

-- Conferência: os saldos calculados devem ser Mesa=2 e Taças=90.
select
  i.name,
  i.minimum_quantity,
  coalesce(sum(case
    when m.movement_type = 'entrada' then m.quantity
    when m.movement_type = 'saida' then -m.quantity
    else 0
  end), 0) as current_quantity
from public.inventory_items i
left join public.inventory_movements m on m.item_id = i.id
where lower(i.name) in ('mesa', 'taças', 'tacas')
group by i.id, i.name, i.minimum_quantity
order by i.name;
