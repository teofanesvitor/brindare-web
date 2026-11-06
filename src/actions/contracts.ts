"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { contractSchema } from "@/lib/contracts/schema";
import { generateContract } from "@/lib/contracts/generate";

export type ContractActionResult =
  | { ok: true; name: string; documentUrl: string; pdfUrl: string }
  | { ok: false; message: string };

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
    const { data: savedContract, error } = await supabase.from("contracts").insert({
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
    }).select("id").single();
    if (error) {
      await supabase.storage.from("contracts").remove([generated.storagePath]);
      return { ok: false, message: `DOCX criado, mas não foi possível registrar o contrato: ${error.message}` };
    }
    const { error: eventError } = await supabase.from("events").insert({
      contract_id: savedContract.id,
      client_id: parsed.data.clientId || null,
      client_name: parsed.data.client,
      event_date: parsed.data.eventDate,
      event_time: parsed.data.eventTime || null,
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
      created_by: user.id,
    });
    if (eventError) return { ok: false, message: `DOCX gerado e salvo, mas o evento não entrou na agenda: ${eventError.message}` };
    return { ok: true, name: generated.name, documentUrl: generated.documentUrl, pdfUrl: generated.pdfUrl };
  } catch (error) {
    if (generated?.storagePath) await supabase.storage.from("contracts").remove([generated.storagePath]);
    const message = error instanceof Error ? error.message : "Falha desconhecida ao gerar contrato.";
    return { ok: false, message: `Não foi possível gerar o contrato. ${message}` };
  }
}
