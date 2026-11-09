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
const titleCase = (value: string) => value.toLocaleLowerCase("pt-BR").replace(/(^|\s|[-'])\p{L}/gu, (match) => match.toLocaleUpperCase("pt-BR"));
const digits = (value: string) => value.replace(/\D/g, "");
const validCpf = (value: string) => {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (base: string, factor: number) => {
    let sum = 0;
    for (const char of base) sum += Number(char) * factor--;
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digit(cpf.slice(0, 10), 11) === Number(cpf[10]);
};

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
    full_name: titleCase(text(form, "full_name")), phone: digits(text(form, "phone")),
    email: text(form, "email").toLowerCase(), cpf: digits(text(form, "cpf")),
    rg: text(form, "rg"), address: titleCase(text(form, "address")),
    neighborhood: titleCase(text(form, "neighborhood")), city: titleCase(text(form, "city")),
    event_date: text(form, "event_date"), event_time: text(form, "event_time"),
    toast_time: text(form, "toast_time"), venue: titleCase(text(form, "venue")),
    ceremony_contact: titleCase(text(form, "ceremony_contact")), referral: titleCase(text(form, "referral")),
  };
  if (payload.full_name.length < 3 || !/^\d{11}$/.test(payload.phone) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
      !validCpf(payload.cpf) || !payload.address || !payload.event_date ||
      !/^\d{2}:\d{2}$/.test(payload.event_time) || !payload.venue) {
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
    full_name: titleCase(text(form, "full_name") || p.full_name || ""),
    cpf: digits(text(form, "cpf") || p.cpf || ""), rg: text(form, "rg") || p.rg || null,
    phone: digits(text(form, "phone") || p.phone || "") || null,
    email: (text(form, "email") || p.email || "").toLowerCase() || null,
    address: titleCase(text(form, "address") || p.address || ""),
    neighborhood: titleCase(text(form, "neighborhood") || p.neighborhood || "") || null,
    city: titleCase(text(form, "city") || p.city || "") || null,
    event_details: {
      event_date: p.event_date || "", event_time: p.event_time || "", toast_time: p.toast_time || "",
      venue: titleCase(p.venue || ""), ceremony_contact: titleCase(p.ceremony_contact || ""), referral: titleCase(p.referral || ""),
    },
  };
  if (client.full_name.length < 3) throw new Error("Informe o nome completo do cliente.");
  if (!client.cpf || !validCpf(client.cpf)) throw new Error("Informe um CPF válido.");
  if (!client.address) throw new Error("Informe o endereço do cliente.");
  // CPF é a chave de identidade do cliente: reutiliza cadastro existente em vez de duplicá-lo.
  const { data: existingClients, error: lookupError } = await supabase
    .from("clients").select("id,cpf").not("cpf", "is", null);
  if (lookupError) throw new Error("Não foi possível verificar o CPF cadastrado: " + lookupError.message);

  let clientId = existingClients?.find((row) => digits(row.cpf || "") === client.cpf)?.id;

  if (clientId) {
    // Atualiza somente os dados pessoais revisados. event_details é preservado:
    // os dados do novo evento vêm diretamente desta solicitação no formulário do contrato.
    const { error: updateClientError } = await supabase.from("clients").update({
      full_name: client.full_name, rg: client.rg, phone: client.phone,
      email: client.email, address: client.address, neighborhood: client.neighborhood, city: client.city,
    }).eq("id", clientId);
    if (updateClientError) throw new Error("O cliente já existe, mas não foi possível atualizar seus dados: " + updateClientError.message);
  } else {
    const { data: created, error } = await supabase.from("clients").insert(client).select("id").single();
    if (error) {
      // Trata também duas conversões simultâneas do mesmo CPF.
      if (error.code !== "23505") throw new Error(error.message);
      const { data: concurrentClients, error: retryError } = await supabase
        .from("clients").select("id,cpf").not("cpf", "is", null);
      const match = concurrentClients?.find((row) => digits(row.cpf || "") === client.cpf);
      if (retryError || !match) throw new Error("Já existe um cadastro com este CPF. Atualize a página e tente novamente.");
      clientId = match.id;
    } else {
      clientId = created.id;
    }
  }

  const { error: updateError } = await supabase.from("client_intakes").update({
    status: "converted", client_id: clientId,
  }).eq("id", intake.id);
  if (updateError) throw new Error("Cliente identificado, mas não foi possível concluir a solicitação: " + updateError.message);
  revalidatePath("/clientes");
  redirect(`/contratos?clientId=${clientId}&intakeId=${intake.id}`);
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
  const { error } = await supabase.rpc("register_inventory_movement", {
    p_item_id: itemId,
    p_movement_type: movementType,
    p_quantity: quantity,
    p_description: text(form, "description") || null,
  });
  if (error) throw new Error(error.message || "Não foi possível registrar a movimentação.");
  revalidatePath("/estoque");
}

export async function updateEventStatus(form: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = text(form, "event_id");
  const status = text(form, "status");
  if (!id || !["A pagar", "Confirmado", "Pago", "Realizado", "Cancelado"].includes(status)) {
    throw new Error("Status de evento inválido.");
  }
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}


export async function registerEventPayment(form: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const eventId = text(form, "event_id");
  const amount = number(form, "amount");
  const paidAt = text(form, "paid_at");
  const paymentMethod = text(form, "payment_method");
  const notes = text(form, "notes");

  if (!eventId || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Selecione o evento e informe um valor válido.");
  }
  if (paidAt && !/^\\d{4}-\\d{2}-\\d{2}$/.test(paidAt)) {
    throw new Error("Informe uma data de pagamento válida.");
  }

  const { error } = await supabase.rpc("register_event_payment", {
    p_event_id: eventId,
    p_amount_cents: Math.round(amount * 100),
    p_paid_at: paidAt || new Date().toISOString().slice(0, 10),
    p_payment_method: paymentMethod || null,
    p_notes: notes || null,
  });
  if (error) throw new Error(error.message || "Não foi possível registrar o pagamento.");

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}


export async function uploadSignedEventContract(form: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const admin = createAdminClient();
  const eventId = text(form, "event_id");
  const file = form.get("signed_contract");

  if (!eventId || !(file instanceof File) || file.size === 0) {
    throw new Error("Selecione o evento e o arquivo do contrato assinado.");
  }
  const allowedTypes: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/jpeg": "jpg",
    "image/png": "png",
  };
  const extension = allowedTypes[file.type];
  if (!extension) {
    throw new Error("Formato não permitido. Envie PDF, DOCX, JPG ou PNG.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("O arquivo deve ter no máximo 10 MB.");
  }

  const { data: event, error: eventError } = await supabase
    .from("events").select("id").eq("id", eventId).maybeSingle();
  if (eventError || !event) throw new Error("Evento não encontrado ou sem permissão.");

  const safeName = file.name.replace(/[^\\p{L}\\p{N}._-]/gu, "_").slice(-100) || `contrato-assinado.${extension}`;
  const storagePath = `signed/${eventId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage.from("contracts").upload(
    storagePath, await file.arrayBuffer(),
    { contentType: file.type, upsert: false }
  );
  if (uploadError) throw new Error("Não foi possível armazenar o contrato assinado: " + uploadError.message);

  const { error: recordError } = await supabase.from("event_signed_contracts").insert({
    event_id: eventId,
    storage_path: storagePath,
    original_file_name: safeName,
    mime_type: file.type,
    file_size: file.size,
    created_by: user.id,
  });
  if (recordError) {
    await admin.storage.from("contracts").remove([storagePath]);
    throw new Error("Arquivo enviado, mas não foi possível registrar o recebimento: " + recordError.message);
  }

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}
