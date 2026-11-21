import { FileText, FileDown } from "lucide-react";
import { ContractForm } from "./contract-form";
import { createClient } from "@/lib/supabase/server";
import { formatDateOnly } from "@/lib/timezone";

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
export default async function ContratosPage({ searchParams }: { searchParams: Promise<{ clientId?: string; intakeId?: string; contractId?: string }> }) {
  const { clientId, intakeId, contractId } = await searchParams;
  const supabase = await createClient();
  const [{ data: contracts, error }, { data: client }, { data: intake }] = await Promise.all([
    supabase.from("contracts").select("id, client_name, event_date, package_name, total_cents, docx_path, file_name, created_at").order("docx_created_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(20),
    clientId ? supabase.from("clients").select("id,full_name,cpf,rg,phone,email,address,neighborhood,city,event_details").eq("id", clientId).maybeSingle() : Promise.resolve({ data: null }),
    intakeId ? supabase.from("client_intakes").select("payload").eq("id", intakeId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { data: selectedContract } = contractId
    ? await supabase.from("contracts").select("id,input_snapshot").eq("id", contractId).maybeSingle()
    : { data: null };
  const details = (client?.event_details || {}) as Record<string,string>;
  const intakeDetails = (intake?.payload || {}) as Record<string,string>;
  const eventDetails = intakeDetails.event_date ? intakeDetails : details;
  const snapshot = (selectedContract?.input_snapshot || null) as Record<string, unknown> | null;
  const initialData = snapshot ? {
    ...snapshot,
    contractId: selectedContract!.id,
  } as {
    contractId: string; clientId?: string; client?: string; cpf?: string; rg?: string; phone?: string;
    email?: string; address?: string; neighborhood?: string; city?: string; eventDate?: string;
    eventTime?: string; toastTime?: string; venue?: string; packageName?: string;
    travel?: number; deposit?: number; mesa?: number; tacas?: number; fogos?: number; sparkles?: number; champagne?: number;
  } : client ? {
    clientId: client.id, client: client.full_name, cpf: client.cpf || "", rg: client.rg || "",
    phone: client.phone || "", email: client.email || "", address: client.address || "",
    neighborhood: client.neighborhood || "", city: client.city || "",
    eventDate: eventDetails.event_date || "", eventTime: eventDetails.event_time || "", toastTime: eventDetails.toast_time || "", venue: eventDetails.venue || "",
    packageName: intakeDetails.package_preference || "",
    additionalRequests: intakeDetails.additional_requests || "",
  } : undefined;
  const history = await Promise.all((contracts || []).map(async (item) => {
    if (!item.docx_path) return { ...item, docxUrl: null };
    const { data } = await supabase.storage.from("contracts").createSignedUrl(item.docx_path, 3600, { download: item.file_name || "contrato.docx" });
    return { ...item, docxUrl: data?.signedUrl || null };
  }));
  return <main className="content"><div className="page-heading"><div><h1>Geração de contratos</h1></div></div>
    <div className="contract-notice"><FileText size={18}/><div><strong>Modelo oficial Brindare</strong></div></div>
    <ContractForm initialData={initialData}/>
    <section className="contract-history"><div className="history-heading"><div><h2>Contratos recentes</h2></div></div>
      {error ? <div className="contract-error">Não foi possível carregar o histórico. Verifique se a migration de contratos foi aplicada no Supabase.</div> : !history.length ? <div className="history-empty">Nenhum contrato registrado ainda.</div> : <div className="history-list">{history.map((item) => <article className="history-row" key={item.id}><div className="history-main"><strong>{item.client_name}</strong><span>{formatDateOnly(item.event_date)} · {item.package_name} · {brl(item.total_cents)}</span><small>{item.file_name}</small></div><div className="history-actions">{item.docxUrl ? <a href={item.docxUrl} download={item.file_name || true} aria-label="Baixar DOCX"><FileDown size={16}/> DOCX</a> : <span>DOCX arquivado</span>}<a href={"/contratos?contractId=" + item.id}>Refazer</a></div></article>)}</div>}
    </section>
  </main>;
}
