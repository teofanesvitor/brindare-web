"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function changeAccountPassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirmation") || "");

  if (password.length < 10) redirect("/configuracoes?error=short_password");
  if (password !== confirmation) redirect("/configuracoes?error=password_mismatch");

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/configuracoes?error=password_update_failed");

  redirect("/configuracoes?success=password_updated");
}
