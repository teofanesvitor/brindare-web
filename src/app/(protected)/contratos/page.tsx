import { FileText, FileDown } from "lucide-react";
import { ContractForm } from "./contract-form";
import { createClient } from "@/lib/supabase/server";

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
export default async function ContratosPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const { clientId } = await searchParams;
  const supabase = await createClient();
  const [{ data: contracts, error }, { data: client }] = await Promise.all([
    supabase.from("contracts").select("id, client_name, event_date, package_name, total_cents, docx_path, file_name, created_at").order("created_at", { ascending: false }).limit(20),
    clientId ? supabase.from("clients").select("id,full_name,cpf,rg,phone,email,address,neighborhood,city,event_details").eq("id", clientId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const details = (client?.event_details || {}) as Record<string,string>;
  const initialData = client ? {
    clientId: client.id, client: client.full_name, cpf: client.cpf || "", rg: client.rg || "",
    phone: client.phone || "", email: client.email || "", address: client.address || "",
    neighborhood: client.neighborhood || "", city: client.city || "",
    eventDate: details.event_date || "", eventTime: details.event_time || "", toastTime: details.toast_time || "", venue: details.venue || "",
  } : undefined;
  const history = await Promise.all((contracts || []).map(async (item) => {
    if (!item.docx_path) return { ...item, docxUrl: null };
    const { data } = await supabase.storage.from("contracts").createSignedUrl(item.docx_path, 3600);
    return { ...item, docxUrl: data?.signedUrl || null };
  }));
  return <main className="content"><div className="page-heading"><div><div className="eyebrow">Documentos</div><h1>Geração de contratos</h1><p>Preencha o modelo oficial e gere um arquivo DOCX editável.</p></div></div>
    <div className="contract-notice"><FileText size={18}/><div><strong>Modelo oficial Brindare</strong><p>O documento original é preservado. Cada geração cria um novo DOCX privado no Supabase Storage.</p></div></div>
    <ContractForm initialData={initialData}/>
    <section className="contract-history"><div className="history-heading"><div><h2>Contratos recentes</h2><p>Últimos 20 documentos gerados nesta aplicação.</p></div></div>
      {error ? <div className="contract-error">Não foi possível carregar o histórico. Verifique se a migration de contratos foi aplicada no Supabase.</div> : !history.length ? <div className="history-empty">Nenhum contrato registrado ainda.</div> : <div className="history-list">{history.map((item) => <article className="history-row" key={item.id}><div className="history-main"><strong>{item.client_name}</strong><span>{new Date(`${item.event_date}T12:00:00`).toLocaleDateString("pt-BR")} · {item.package_name} · {brl(item.total_cents)}</span><small>{item.file_name}</small></div><div className="history-actions">{item.docxUrl ? <a href={item.docxUrl} target="_blank" rel="noreferrer" aria-label="Baixar DOCX"><FileDown size={16}/> DOCX</a> : <span>Arquivo legado no Google Drive</span>}</div></article>)}</div>}
    </section>
  </main>;
}
