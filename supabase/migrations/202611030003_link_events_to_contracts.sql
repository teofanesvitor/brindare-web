alter table public.events
  add column if not exists contract_id uuid unique references public.contracts(id) on delete set null;
