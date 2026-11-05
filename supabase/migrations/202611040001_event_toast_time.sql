-- Brindare: horário específico do brinde (opcional) no evento.
alter table public.events
  add column if not exists toast_time time;
