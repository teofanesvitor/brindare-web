"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function deleteConvertedIntakePayload(form: FormData) {
  await requireAdmin();
  const intakeId = String(form.get("intake_id") ?? "").trim();
  if (!intakeId) throw new Error("Solicitação inválida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_intakes")
    .update({ payload: null })
    .eq("id", intakeId)
    .eq("status", "converted")
    .not("client_id", "is", null)
    .not("payload", "is", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error("Não foi possível excluir os dados enviados: " + error.message);
  if (!data) throw new Error("A solicitação não está convertida ou os dados já foram excluídos.");

  revalidatePath("/clientes");
}
