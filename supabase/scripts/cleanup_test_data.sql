-- LIMPEZA DE DADOS DE TESTE — Brindare Web
-- Executar manualmente no Supabase SQL Editor, após exportar um backup.
-- Compatível com bancos nos quais a migration de compras do estoque ainda não foi aplicada.
-- Preserva: auth.users, public.profiles, configurações e catálogo public.inventory_items.
-- Remove dados operacionais existentes. Tabelas opcionais são verificadas antes do DELETE.

begin;

do $cleanup$
declare
  v_table text;
  v_tables text[] := array[
    'public.event_signed_contracts',
    'public.event_payments',
    'public.inventory_movements',
    'public.inventory_purchase_installments',
    'public.inventory_purchases',
    'public.events',
    'public.contracts',
    'public.client_intakes',
    'public.clients'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass(v_table) is not null then
      execute format('delete from %s', v_table);
      raise notice 'Limpeza concluída: %', v_table;
    else
      raise notice 'Tabela não existe, ignorada: %', v_table;
    end if;
  end loop;
end
$cleanup$;

commit;

-- Conferência pós-limpeza. Tabelas inexistentes aparecem como NULL, sem interromper a consulta.
select 'events' as table_name, (select count(*) from public.events) as remaining
union all select 'event_payments', (select count(*) from public.event_payments)
union all select 'event_signed_contracts', (select count(*) from public.event_signed_contracts)
union all select 'contracts', (select count(*) from public.contracts)
union all select 'clients', (select count(*) from public.clients)
union all select 'client_intakes', (select count(*) from public.client_intakes)
union all select 'inventory_movements', (select count(*) from public.inventory_movements);

select
  to_regclass('public.inventory_purchases') as inventory_purchases_table,
  to_regclass('public.inventory_purchase_installments') as inventory_purchase_installments_table;

select count(*) as inventory_items_preserved from public.inventory_items;
