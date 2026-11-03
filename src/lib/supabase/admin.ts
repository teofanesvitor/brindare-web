import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv, getServiceRoleKey } from "./env";

/** Cliente privilegiado: usar exclusivamente em scripts/rotas server-side confiáveis. */
export function createAdminClient() {
  const env = getPublicSupabaseEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
