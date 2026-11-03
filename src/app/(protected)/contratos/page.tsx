import { FileText, ExternalLink, FileDown } from "lucide-react";
import { ContractForm } from "./contract-form";
import { createClient } from "@/lib/supabase/server";

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
export default async function ContratosPage() {
  const supabase = await createClient();
  const { data: contracts, error } = await supabase.from("contracts")
    .select("id, client_name, event_date, package_name, total_cents, google_document_url, google_pdf_url, file_name, created_at")
    .order("created_at", { ascending: false }).limit(20);
  return <main className="content"><div className="page-heading"><div><div className="eyebrow">Documentos</div><h1>Geração de contratos</h1><p>Gere o contrato editável no Google Docs e sua versão em PDF.</p></div></div>
    <div className="contract-notice"><FileText size={18}/><div><strong>Modelo oficial Brindare</strong><p>Será utilizada uma cópia do modelo Google Docs configurado. O modelo original não será alterado.</p></div></div>
    <ContractForm/>
    <section className="contract-history"><div className="history-heading"><div><h2>Contratos recentes</h2><p>Últimos 20 documentos gerados nesta aplicação.</p></div></div>
      {error ? <div className="contract-error">Não foi possível carregar o histórico. Verifique se a migration de contratos foi aplicada no Supabase.</div> : !contracts?.length ? <div className="history-empty">Nenhum contrato registrado ainda.</div> : <div className="history-list">{contracts.map((item) => <article className="history-row" key={item.id}><div className="history-main"><strong>{item.client_name}</strong><span>{new Date(`${item.event_date}T12:00:00`).toLocaleDateString("pt-BR")} · {item.package_name} · {brl(item.total_cents)}</span><small>{item.file_name}</small></div><div className="history-actions"><a href={item.google_document_url} target="_blank" rel="noreferrer" aria-label="Abrir Google Docs"><ExternalLink size={16}/> Docs</a><a href={item.google_pdf_url} target="_blank" rel="noreferrer" aria-label="Abrir PDF"><FileDown size={16}/> PDF</a></div></article>)}</div>}
    </section>
  </main>;
}
