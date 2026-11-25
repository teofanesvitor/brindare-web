"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function deleteClientIntake(form: FormData) {
  await requireAdmin();
  const intakeId = String(form.get("intake_id") ?? "").trim();
  if (!intakeId) throw new Error("Solicitação inválida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_intakes")
    .delete()
    .eq("id", intakeId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error("Não foi possível excluir a solicitação: " + error.message);
  if (!data) throw new Error("Solicitação não encontrada ou já excluída.");

  revalidatePath("/clientes");
}
