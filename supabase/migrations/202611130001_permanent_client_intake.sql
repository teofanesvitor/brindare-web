-- Permite solicitações públicas sem token individual.
-- Links antigos continuam válidos: seus registros mantêm token_hash, created_by e expires_at preenchidos.
alter table public.client_intakes
  alter column created_by drop not null,
  alter column token_hash drop not null,
  alter column expires_at drop not null;

-- Rate limit por IP anonimizado (hash SHA-256), sem persistir o endereço IP bruto.
create table if not exists public.client_intake_rate_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.client_intake_rate_limits enable row level security;

create or replace function public.consume_client_intake_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_ip_hash is null or length(p_ip_hash) <> 64 then
    return false;
  end if;

  insert into public.client_intake_rate_limits (ip_hash, window_started_at, request_count, updated_at)
  values (p_ip_hash, now(), 1, now())
  on conflict (ip_hash) do update
    set request_count = case
          when public.client_intake_rate_limits.window_started_at < now() - interval '15 minutes' then 1
          else public.client_intake_rate_limits.request_count + 1
        end,
        window_started_at = case
          when public.client_intake_rate_limits.window_started_at < now() - interval '15 minutes' then now()
          else public.client_intake_rate_limits.window_started_at
        end,
        updated_at = now()
  returning request_count into v_count;

  return v_count <= 10;
end;
$$;

revoke all on function public.consume_client_intake_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_client_intake_rate_limit(text) to service_role;

-- Limpeza automática de hashes antigos durante novas submissões, sem guardar IPs brutos.
create or replace function public.cleanup_client_intake_rate_limits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.client_intake_rate_limits
  where updated_at < now() - interval '2 days';
$$;

revoke all on function public.cleanup_client_intake_rate_limits() from public, anon, authenticated;
grant execute on function public.cleanup_client_intake_rate_limits() to service_role;
