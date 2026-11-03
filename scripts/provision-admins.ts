import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { parseAdminEmails } from "../src/lib/validation/admin-emails";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!url || !serviceKey || !appUrl) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_APP_URL.");
  const emails = parseAdminEmails(process.env.ADMIN_EMAILS);
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  for (const email of emails) {
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/auth/callback`,
    });
    let userId = inviteData.user?.id;
    if (inviteError) {
      // Reexecução idempotente: se o e-mail já existir, localizar o usuário sem revelar dados em logs.
      if (!inviteError.message.toLowerCase().includes("already") && !inviteError.message.toLowerCase().includes("registered")) {
        throw new Error(`Falha ao convidar ${email}: ${inviteError.message}`);
      }
      const { data: users, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;
      userId = users.users.find((user) => user.email?.toLowerCase() === email)?.id;
    }
    if (!userId) throw new Error(`Não foi possível localizar o usuário provisionado: ${email}`);
    const { error: profileError } = await supabase.from("profiles").upsert({ id: userId, role: "admin", full_name: email.split("@")[0] }, { onConflict: "id" });
    if (profileError) throw new Error(`Falha ao atribuir perfil administrativo a ${email}: ${profileError.message}`);
    console.log(`Administrador provisionado: ${email}`);
  }
  console.log("Provisionamento concluído. Cada usuário deve aceitar o convite e definir sua própria senha.");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Erro no provisionamento."); process.exit(1); });
