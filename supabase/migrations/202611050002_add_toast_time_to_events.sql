-- Armazena separadamente o horário do brinde no evento.
-- O formulário envia o valor no formato HH:MM.
alter table public.events
  add column if not exists toast_time time;

-- Atualiza o cache de schema usado pelo PostgREST/Supabase.
notify pgrst, 'reload schema';
