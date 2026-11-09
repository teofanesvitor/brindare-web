-- LIMPEZA DE DADOS DE TESTE — Brindare Web
-- Executar manualmente no Supabase SQL Editor, após exportar um backup.
-- Preserva: auth.users, public.profiles, configurações e catálogo public.inventory_items.
-- Remove: eventos, pagamentos, clientes, pré-cadastros, contratos, histórico de
-- contratos assinados, compras de estoque, parcelas e movimentações de estoque.
-- Não remove arquivos do Storage; esses devem ser tratados separadamente.

begin;

-- Filhos de eventos e contratos (FKs com ON DELETE RESTRICT).
delete from public.event_signed_contracts;
delete from public.event_payments;

-- Movimentações e compras são dados operacionais de teste; o catálogo fica intacto.
delete from public.inventory_movements;
delete from public.inventory_purchase_installments;
delete from public.inventory_purchases;

-- Eventos podem referenciar contratos; apagar eventos primeiro.
delete from public.events;
delete from public.contracts;

-- Pré-cadastros referenciam clientes com ON DELETE SET NULL.
delete from public.client_intakes;
delete from public.clients;

commit;

-- Conferência pós-limpeza: todos os resultados abaixo devem ser zero.
select 'events' as table_name, count(*) as remaining from public.events
union all select 'event_payments', count(*) from public.event_payments
union all select 'event_signed_contracts', count(*) from public.event_signed_contracts
union all select 'contracts', count(*) from public.contracts
union all select 'clients', count(*) from public.clients
union all select 'client_intakes', count(*) from public.client_intakes
union all select 'inventory_movements', count(*) from public.inventory_movements
union all select 'inventory_purchases', count(*) from public.inventory_purchases
union all select 'inventory_purchase_installments', count(*) from public.inventory_purchase_installments;

-- O catálogo é preservado; confira a quantidade de itens cadastrados.
select count(*) as inventory_items_preserved from public.inventory_items;
