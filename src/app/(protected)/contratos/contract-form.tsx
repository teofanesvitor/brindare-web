"use client";

import { useState, useTransition } from "react";
import { FileText, FileDown, LoaderCircle } from "lucide-react";
import { generateContractAction, type ContractActionResult } from "@/actions/contracts";

type InitialData = {
  clientId?: string; client?: string; cpf?: string; rg?: string; phone?: string; email?: string;
  address?: string; neighborhood?: string; city?: string; eventDate?: string; eventTime?: string; venue?: string;
};
type FieldProps = { label: string; name: string; type?: string; required?: boolean; defaultValue?: string | number; min?: string; step?: string };
function Field({ label, name, type = "text", required = false, defaultValue = "", min, step }: FieldProps) {
  return <label className="contract-field"><span>{label}{required ? " *" : ""}</span><input name={name} type={type} required={required} defaultValue={defaultValue} min={min} step={step} /></label>;
}
export function ContractForm({ initialData = {} }: { initialData?: InitialData }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ContractActionResult | null>(null);
  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => setResult(await generateContractAction(formData)));
  }
  return <form action={submit} className="contract-form">
    {initialData.clientId && <input type="hidden" name="clientId" value={initialData.clientId}/>}
    {initialData.clientId && <div className="contract-notice"><strong>Cadastro pré-preenchido a partir da solicitação do cliente.</strong> Revise os dados e complete as condições comerciais antes de gerar o contrato.</div>}
    <section className="contract-panel"><h2>Evento</h2><div className="contract-grid">
      <Field label="Data do evento" name="eventDate" type="date" required defaultValue={initialData.eventDate || ""}/>
      <Field label="Horário" name="eventTime" type="time" defaultValue={initialData.eventTime || ""}/>
      <Field label="Local do evento" name="venue" defaultValue={initialData.venue || ""}/>
      <Field label="Pacote" name="packageName" required />
    </div></section>
    <section className="contract-panel"><h2>Dados do contratante</h2><div className="contract-grid">
      <Field label="Nome completo" name="client" required defaultValue={initialData.client || ""}/>
      <Field label="CPF" name="cpf" required defaultValue={initialData.cpf || ""}/>
      <Field label="RG" name="rg" defaultValue={initialData.rg || ""}/>
      <Field label="Telefone" name="phone" defaultValue={initialData.phone || ""}/>
      <Field label="E-mail" name="email" type="email" defaultValue={initialData.email || ""}/>
      <Field label="Endereço" name="address" defaultValue={initialData.address || ""}/>
      <Field label="Bairro" name="neighborhood" defaultValue={initialData.neighborhood || ""}/>
      <Field label="Município" name="city" defaultValue={initialData.city || ""}/>
    </div></section>
    <section className="contract-panel"><h2>Valores (R$)</h2><div className="contract-grid">
      <Field label="Valor total" name="total" type="number" required min="0" step="0.01" defaultValue="0" />
      <Field label="Entrada" name="deposit" type="number" required min="0" step="0.01" defaultValue="0" />
      <Field label="Restante" name="balance" type="number" required min="0" step="0.01" defaultValue="0" />
    </div></section>
    <section className="contract-panel"><h2>Itens do pacote</h2><div className="contract-grid">
      <Field label="Mesa de apoio (0 = não incluir)" name="mesa" type="number" min="0" step="1" defaultValue="0" />
      <Field label="Taças de vidro" name="tacas" type="number" min="0" step="1" defaultValue="0" />
      <Field label="Pares de fogos indoor" name="fogos" type="number" min="0" step="1" defaultValue="0" />
      <Field label="Sparkles" name="sparkles" type="number" min="0" step="1" defaultValue="0" />
      <Field label="Unidades de champagne" name="champagne" type="number" min="0" step="1" defaultValue="0" />
    </div><p className="contract-hint">A montagem e organização do cenário é incluída automaticamente, conforme o Apps Script original. A cláusula de segurança é adicionada quando a quantidade de fogos for maior que zero.</p></section>
    <button className="contract-submit" type="submit" disabled={pending}>{pending ? <><LoaderCircle size={17} className="spin"/> Gerando documentos…</> : <><FileText size={17}/> Gerar contrato + PDF</>}</button>
    {result && (result.ok ? <div className="contract-success"><strong>Contrato gerado.</strong><span>{result.name}</span><div className="contract-links"><a href={result.documentUrl} target="_blank" rel="noreferrer"><FileText size={16}/> Abrir Google Docs</a><a href={result.pdfUrl} target="_blank" rel="noreferrer"><FileDown size={16}/> Abrir PDF</a></div></div> : <div className="contract-error">{result.message}</div>)}
  </form>;
}
