"use server";

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const number = (form: FormData, key: string) => Math.max(0, Number(form.get(key) || 0));

export async function createClientIntakeLink() {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const token = randomBytes(32).toString("base64url");
  const { error } = await supabase.from("client_intakes").insert({
    created_by: user.id, token_hash: hashToken(token),
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  });
  if (error) throw new Error("Não foi possível criar o link de cadastro.");
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  redirect(`/clientes?link=${encodeURIComponent(`${base}/cadastro-cliente/${token}`)}`);
}

export async function submitClientIntake(form: FormData) {
  const token = text(form, "token");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) redirect("/cadastro-invalido");
  const payload = {
    full_name: text(form, "full_name"), phone: text(form, "phone"),
    email: text(form, "email").toLowerCase(), cpf: text(form, "cpf"),
    rg: text(form, "rg"), address: text(form, "address"),
    neighborhood: text(form, "neighborhood"), city: text(form, "city"),
    event_date: text(form, "event_date"), event_time: text(form, "event_time"),
    venue: text(form, "venue"), ceremony_contact: text(form, "ceremony_contact"),
    referral: text(form, "referral"),
  };
  if (payload.full_name.length < 3 || payload.phone.length < 8 || !payload.email.includes("@")) {
    redirect(`/cadastro-cliente/${token}?error=invalid`);
  }
  const admin = createAdminClient();
  const { data: intake } = await admin.from("client_intakes").select("id,status,expires_at")
    .eq("token_hash", hashToken(token)).maybeSingle();
  if (!intake || intake.status !== "pending" || new Date(intake.expires_at) < new Date()) redirect("/cadastro-invalido");
  const { data: updated, error } = await admin.from("client_intakes").update({
    payload, status: "submitted", submitted_at: new Date().toISOString(),
  }).eq("id", intake.id).eq("status", "pending").select("id").maybeSingle();
  if (error || !updated) redirect(`/cadastro-cliente/${token}?error=save`);
  redirect("/cadastro-enviado");
}

export async function convertIntakeToClient(form: FormData) {
  await requireAdmin();
  const intakeId = text(form, "intake_id");
  const supabase = await createClient();
  const { data: intake, error: intakeError } = await supabase.from("client_intakes")
    .select("id,payload,status").eq("id", intakeId).single();
  if (intakeError || !intake || intake.status !== "submitted" || !intake.payload) throw new Error("Solicitação não encontrada ou já processada.");
  const p = intake.payload as Record<string, string>;
  const client = {
    full_name: text(form, "full_name") || p.full_name || "",
    cpf: text(form, "cpf") || p.cpf || null, rg: text(form, "rg") || p.rg || null,
    phone: text(form, "phone") || p.phone || null,
    email: (text(form, "email") || p.email || "").toLowerCase() || null,
    address: text(form, "address") || p.address || null,
    neighborhood: text(form, "neighborhood") || p.neighborhood || null,
    city: text(form, "city") || p.city || null,
    event_details: {
      event_date: p.event_date || "", event_time: p.event_time || "",
      venue: p.venue || "", ceremony_contact: p.ceremony_contact || "", referral: p.referral || "",
    },
  };
  if (client.full_name.length < 3) throw new Error("Informe o nome completo do cliente.");
  const { data: created, error } = await supabase.from("clients").insert(client).select("id").single();
  if (error) throw new Error(error.message);
  const { error: updateError } = await supabase.from("client_intakes").update({ status: "converted", client_id: created.id }).eq("id", intake.id);
  if (updateError) throw new Error("Cliente criado, mas não foi possível concluir a solicitação: " + updateError.message);
  revalidatePath("/clientes");
  redirect(`/contratos?clientId=${created.id}`);
}

export async function createEvent(form: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const total = number(form, "total"), deposit = number(form, "deposit");
  const payload = {
    client_name: text(form, "client_name"), event_date: text(form, "event_date"),
    event_time: text(form, "event_time") || null, venue: text(form, "venue"),
    ceremony_contact: text(form, "ceremony_contact") || null, referral: text(form, "referral") || null,
    package_name: text(form, "package_name"), total_cents: Math.round(total * 100),
    deposit_cents: Math.round(deposit * 100), balance_cents: Math.max(0, Math.round((total - deposit) * 100)),
    status: text(form, "status") || "A pagar", glasses: Math.floor(number(form, "glasses")),
    fireworks: Math.floor(number(form, "fireworks")), sparkles: Math.floor(number(form, "sparkles")),
    tables: Math.floor(number(form, "tables")), champagne: Math.floor(number(form, "champagne")),
    travel_cents: Math.round(number(form, "travel") * 100), created_by: user.id,
  };
  if (!payload.client_name || !payload.event_date || !payload.venue || !payload.package_name) throw new Error("Preencha cliente, data, local e pacote.");
  const { error } = await supabase.from("events").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/agenda"); revalidatePath("/dashboard"); redirect("/agenda?created=1");
}

export async function createInventoryItem(form: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({
    name: text(form, "name"), unit: text(form, "unit") || "unidade",
    minimum_quantity: number(form, "minimum_quantity"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/estoque");
}

export async function createInventoryMovement(form: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const itemId = text(form, "item_id");
  const quantity = number(form, "quantity");
  const movementType = text(form, "movement_type");
  if (!itemId || quantity <= 0) throw new Error("Selecione um item e informe uma quantidade maior que zero.");
  if (movementType !== "entrada" && movementType !== "saida") throw new Error("Tipo de movimentação inválido.");
  if (movementType === "saida") {
    const { data: history, error: historyError } = await supabase.from("inventory_movements").select("movement_type,quantity").eq("item_id", itemId);
    if (historyError) throw new Error(historyError.message);
    const balance = (history || []).reduce((sum, row) => sum + (row.movement_type === "entrada" ? Number(row.quantity) : -Number(row.quantity)), 0);
    if (quantity > balance) throw new Error(`Saldo insuficiente. Disponível: ${balance}.`);
  }
  const { error } = await supabase.from("inventory_movements").insert({
    item_id: itemId, movement_type: movementType,
    quantity, description: text(form, "description") || null, created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/estoque");
}
