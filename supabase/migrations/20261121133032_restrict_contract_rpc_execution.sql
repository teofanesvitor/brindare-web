-- Restringe a execução das funções administrativas ao perfil autenticado.
-- As funções também validam is_admin() internamente; esta camada impede
-- chamadas anônimas pela API REST do Supabase.

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.create_contract_and_event(jsonb, jsonb) from public, anon;
grant execute on function public.create_contract_and_event(jsonb, jsonb) to authenticated;

revoke execute on function public.update_contract_and_event(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.update_contract_and_event(uuid, jsonb, jsonb) to authenticated;

revoke execute on function public.cancel_event_and_preserve_payments(uuid) from public, anon;
grant execute on function public.cancel_event_and_preserve_payments(uuid) to authenticated;

revoke execute on function public.purge_orphan_cancelled_contracts() from public, anon;
grant execute on function public.purge_orphan_cancelled_contracts() to authenticated;
