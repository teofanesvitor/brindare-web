"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function cancelEvent(formData: FormData) {
  await requireAdmin();
  const eventId = String(formData.get("event_id") || "").trim();
  if (!eventId) throw new Error("Evento inválido.");

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id,contract_id,status")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event) throw new Error("Evento não encontrado.");
  if (event.status === "Realizado") {
    throw new Error("Um evento realizado não pode ser cancelado por esta operação.");
  }

  const paths: string[] = [];
  if (event.contract_id) {
    const { data: contract, error: contractError } = await supabase
      .from("contracts").select("docx_path").eq("id", event.contract_id).maybeSingle();
    if (contractError) throw new Error("Não foi possível localizar o DOCX do contrato: " + contractError.message);
    if (contract?.docx_path) paths.push(contract.docx_path);
  }

  const { data: signedFiles, error: signedError } = await supabase
    .from("event_signed_contracts").select("storage_path").eq("event_id", eventId);
  if (signedError) throw new Error("Não foi possível localizar os contratos assinados: " + signedError.message);
  for (const file of signedFiles || []) paths.push(file.storage_path);

  const { error } = await supabase.rpc("cancel_event_and_preserve_payments", {
    p_event_id: eventId,
  });
  if (error) throw new Error("Não foi possível cancelar o evento: " + error.message);

  let cleanupWarning = false;
  if (paths.length) {
    const { error: storageError } = await admin.storage.from("contracts").remove([...new Set(paths)]);
    cleanupWarning = Boolean(storageError);
    if (storageError) console.error("Falha ao remover arquivos do evento cancelado:", storageError.message);
  }

  revalidatePath("/agenda");
  revalidatePath("/contratos");
  revalidatePath("/estoque");
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  redirect(cleanupWarning ? "/agenda?cancelled=1&files=warning" : "/agenda?cancelled=1");
}


export async function purgeCancelledEvents() {
  await requireAdmin();
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: cancelled, error: listError } = await supabase
    .from("events").select("id,contract_id").eq("status", "Cancelado");
  if (listError) throw new Error("Não foi possível localizar eventos cancelados: " + listError.message);
  if (!cancelled?.length) redirect("/agenda");

  const paths: string[] = [];
  for (const event of cancelled) {
    if (event.contract_id) {
      const { data: contract, error } = await supabase
        .from("contracts").select("docx_path").eq("id", event.contract_id).maybeSingle();
      if (error) throw new Error("Não foi possível localizar DOCX de contrato cancelado: " + error.message);
      if (contract?.docx_path) paths.push(contract.docx_path);
    }
    const { data: signed, error: signedError } = await supabase
      .from("event_signed_contracts").select("storage_path").eq("event_id", event.id);
    if (signedError) throw new Error("Não foi possível localizar arquivos assinados: " + signedError.message);
    for (const file of signed || []) paths.push(file.storage_path);

    const { error: cancelError } = await supabase.rpc("cancel_event_and_preserve_payments", {
      p_event_id: event.id,
    });
    if (cancelError) throw new Error("Falha ao remover evento cancelado: " + cancelError.message);
  }

  const { data: orphanedPaths, error: orphanError } = await supabase.rpc("purge_orphan_cancelled_contracts");
  if (orphanError) throw new Error("Não foi possível remover contratos cancelados sem evento: " + orphanError.message);
  for (const path of orphanedPaths || []) if (path.docx_path) paths.push(path.docx_path);

  let cleanupWarning = false;
  if (paths.length) {
    const { error } = await admin.storage.from("contracts").remove([...new Set(paths)]);
    cleanupWarning = Boolean(error);
    if (error) console.error("Falha ao remover arquivos antigos de eventos cancelados:", error.message);
  }

  revalidatePath("/agenda");
  revalidatePath("/contratos");
  revalidatePath("/estoque");
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  redirect(cleanupWarning ? "/agenda?purged=1&files=warning" : "/agenda?purged=1");
}
