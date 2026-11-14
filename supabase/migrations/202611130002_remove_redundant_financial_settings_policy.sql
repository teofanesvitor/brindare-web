-- Remove política de leitura redundante: a política FOR ALL já inclui SELECT.
-- Mantém as mesmas permissões efetivas para administradores.
drop policy if exists "Administradores consultam configuração financeira"
  on public.financial_settings;
