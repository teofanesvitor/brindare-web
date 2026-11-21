"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { contractSchema } from "@/lib/contracts/schema";
import { generateContract } from "@/lib/contracts/generate";

export type ContractActionResult =
  | { ok: true; name: string; documentUrl: string }
  | { ok: false; message: string };

async function retainRecentContractDocuments(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: documents, error } = await supabase
    .from("contracts")
    .select("id,docx_path")
    .not("docx_path", "is", null)
    .order("docx_created_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error || !documents || documents.length <= 5) return;

  const expired = documents.slice(5).filter((item) => item.docx_path);
  if (!expired.length) return;
  const { error: removeError } = await supabase.storage
    .from("contracts")
    .remove(expired.map((item) => item.docx_path as string));
  if (removeError) {
    console.error("Falha ao aplicar retenção de DOCX:", removeError.message);
    return;
  }
  await supabase.from("contracts").update({ docx_path: null })
    .in("id", expired.map((item) => item.id));
}

export async function generateContractAction(formData: FormData): Promise<ContractActionResult> {
  const { user } = await requireAdmin();
  const parsed = contractSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message || "Verifique os campos informados." };
  }
  const supabase = await createClient();
  let generated: Awaited<ReturnType<typeof generateContract>> | null = null;
  try {
    generated = await generateContract(parsed.data, supabase, user.id);
    const pContract = {
      created_by: user.id,
      client_name: parsed.data.client,
      event_date: parsed.data.eventDate,
      package_name: parsed.data.packageName,
      total_cents: Math.round(parsed.data.total * 100),
      deposit_cents: Math.round(parsed.data.deposit * 100),
      balance_cents: Math.round(parsed.data.balance * 100),
      docx_path: generated.storagePath,
      file_name: `${generated.name}.docx`,
      input_snapshot: parsed.data,
      status: "generated",
    };
    const pEvent = {
      created_by: user.id,
      client_id: parsed.data.clientId || null,
      client_name: parsed.data.client,
      event_date: parsed.data.eventDate,
      event_time: parsed.data.eventTime || null,
      toast_time: parsed.data.toastTime || null,
      venue: parsed.data.venue,
      package_name: parsed.data.packageName,
      total_cents: Math.round(parsed.data.total * 100),
      deposit_cents: Math.round(parsed.data.deposit * 100),
      balance_cents: Math.round(parsed.data.balance * 100),
      travel_cents: Math.round(parsed.data.travel * 100),
      status: "A pagar",
      glasses: parsed.data.tacas,
      fireworks: parsed.data.fogos,
      sparkles: parsed.data.sparkles,
      tables: parsed.data.mesa,
      champagne: parsed.data.champagne,
    };

    let oldPath: string | null = null;
    let error: { message: string } | null = null;
    if (parsed.data.contractId) {
      const { data: existing, error: lookupError } = await supabase
        .from("contracts").select("docx_path").eq("id", parsed.data.contractId).maybeSingle();
      if (lookupError || !existing) {
        error = { message: lookupError?.message || "Contrato não encontrado." };
      } else {
        oldPath = existing.docx_path;
        const result = await supabase.rpc("update_contract_and_event", {
          p_contract_id: parsed.data.contractId,
          p_contract: pContract,
          p_event: pEvent,
        });
        error = result.error;
      }
    } else {
      const result = await supabase.rpc("create_contract_and_event", {
        p_contract: pContract,
        p_event: pEvent,
      });
      error = result.error;
    }

    if (error) {
      await supabase.storage.from("contracts").remove([generated.storagePath]);
      return { ok: false, message: `Não foi possível registrar o contrato e o evento: ${error.message}` };
    }

    if (oldPath && oldPath !== generated.storagePath) {
      await supabase.storage.from("contracts").remove([oldPath]);
    }
    await retainRecentContractDocuments(supabase);
    revalidatePath("/contratos");
    revalidatePath("/agenda");
    revalidatePath("/dashboard");
    return { ok: true, name: generated.name, documentUrl: generated.documentUrl };
  } catch (error) {
    if (generated?.storagePath) await supabase.storage.from("contracts").remove([generated.storagePath]);
    const message = error instanceof Error ? error.message : "Falha desconhecida ao gerar contrato.";
    return { ok: false, message: `Não foi possível gerar o contrato. ${message}` };
  }
}
