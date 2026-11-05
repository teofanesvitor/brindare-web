"use client";

import { useState, useTransition, type FocusEvent } from "react";
import { FileText, FileDown, LoaderCircle } from "lucide-react";
import { generateContractAction, type ContractActionResult } from "@/actions/contracts";

type InitialData = {
  clientId?: string; client?: string; cpf?: string; rg?: string; phone?: string; email?: string;
  address?: string; neighborhood?: string; city?: string; eventDate?: string; eventTime?: string;
  toastTime?: string; venue?: string;
};
type FieldProps = { label: string; name: string; type?: string; required?: boolean; defaultValue?: string | number; min?: string; step?: string };
function capitalizeWords(value: string) {
  return value.toLocaleLowerCase("pt-BR").replace(/(^|\s|[-'])\p{L}/gu, (match) => match.toLocaleUpperCase("pt-BR"));
}
function Field({ label, name, type = "text", required = false, defaultValue = "", min, step }: FieldProps) {
  const digitsOnly = name === "cpf" || name === "phone";
  const maxLength = name === "cpf" ? 11 : name === "phone" ? 13 : undefined;
  function capitalize(event: FocusEvent<HTMLInputElement>) {
    if (!["email", "cpf", "phone", "rg"].includes(name) && type !== "date" && type !== "time" && type !== "number") {
      event.currentTarget.value = capitalizeWords(event.currentTarget.value);
    }
  }
  function keepDigits(event: React.ChangeEvent<HTMLInputElement>) {
    if (digitsOnly) event.currentTarget.value = event.currentTarget.value.replace(/\\D/g, "").slice(0, maxLength);
  }
  const initialValue = digitsOnly ? String(defaultValue).replace(/\\D/g, "").slice(0, maxLength) : defaultValue;
  return <label className="contract-field"><span>{label}{required ? " *" : ""}</span><input name={name} type={digitsOnly ? "text" : type} inputMode={digitsOnly ? "numeric" : undefined} pattern={digitsOnly ? "[0-9]*" : undefined} maxLength={maxLength} required={required} defaultValue={initialValue} min={min} step={step} onChange={keepDigits} onBlur={capitalize}/></label>;
}
export function ContractForm({ initialData = {} }: { initialData?: InitialData }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ContractActionResult | null>(null);
  const [total, setTotal] = useState("0");
  const [deposit, setDeposit] = useState("0");
  const balance = Math.max(0, Number((Number(total || 0) - Number(deposit || 0)).toFixed(2)));
  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => setResult(await generateContractAction(formData)));
  }
  return <form action={submit} className="contract-form">
    {initialData.clientId && <input type="hidden" name="clientId" value={initialData.clientId}/>}
    {initialData.clientId && <div className="contract-notice"><strong>Cadastro pré-preenchido a partir da solicitação do cliente.</strong> Revise os dados e complete as condições comerciais antes de gerar o contrato.</div>}
    <section className="contract-panel"><h2>Evento</h2><div className="contract-grid">
      <Field label="Data do evento" name="eventDate" type="date" required defaultValue={initialData.eventDate || ""}/>
      <Field label="Horário do evento" name="eventTime" type="time" required defaultValue={initialData.eventTime || ""}/>
      <Field label="Horário do brinde" name="toastTime" type="time" defaultValue={initialData.toastTime || ""}/>
      <Field label="Local do evento" name="venue" required defaultValue={initialData.venue || ""}/>
      <Field label="Pacote" name="packageName" required />
    </div></section>
    <section className="contract-panel"><h2>Dados do contratante</h2><div className="contract-grid">
      <Field label="Nome completo" name="client" required defaultValue={initialData.client || ""}/>
      <Field label="CPF" name="cpf" required defaultValue={initialData.cpf || ""}/>
      <Field label="RG" name="rg" defaultValue={initialData.rg || ""}/>
      <Field label="Telefone" name="phone" defaultValue={initialData.phone || ""}/>
      <Field label="E-mail" name="email" type="email" defaultValue={initialData.email || ""}/>
      <Field label="Endereço" name="address" required defaultValue={initialData.address || ""}/>
      <Field label="Bairro" name="neighborhood" defaultValue={initialData.neighborhood || ""}/>
      <Field label="Município" name="city" defaultValue={initialData.city || ""}/>
    </div></section>
    <section className="contract-panel"><h2>Valores (R$)</h2><div className="contract-grid">
      <label className="contract-field"><span>Valor total *</span><input name="total" type="number" required min="0" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)}/></label>
      <label className="contract-field"><span>Entrada *</span><input name="deposit" type="number" required min="0" max={total} step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)}/></label>
      <label className="contract-field"><span>Restante (calculado automaticamente)</span><input name="balance" type="number" readOnly value={balance.toFixed(2)}/></label>
      <Field label="Deslocamento (R$)" name="travel" type="number" min="0" step="0.01" defaultValue="0"/>
    </div><p className="contract-hint">O restante é sempre calculado como valor total menos entrada.</p></section>
    <section className="contract-panel"><h2>Itens do pacote</h2><div className="contract-grid">
      <Field label="Mesa de apoio (0 = não incluir)" name="mesa" type="number" min="0" step="1" defaultValue="0"/>
      <label className="contract-field"><span>Taças de vidro (quantidade)</span><input name="tacas" type="number" min="0" step="1" list="glass-quantities" defaultValue="0"/><datalist id="glass-quantities"><option value="30"/><option value="55"/><option value="90"/></datalist></label>
      <Field label="Pares de fogos indoor" name="fogos" type="number" min="0" step="1" defaultValue="0"/>
      <Field label="Sparkles" name="sparkles" type="number" min="0" step="1" defaultValue="0"/>
      <Field label="Unidades de champanhe" name="champagne" type="number" min="0" step="1" defaultValue="0"/>
    </div><p className="contract-hint">Pacotes de taças: 30 (4 andares), 55 (5 andares) ou 90 (6 andares). O campo aceita edição livre para exceções, por exemplo 32, 57 ou 92 taças.</p><p className="contract-hint">A montagem e organização do cenário é incluída automaticamente, conforme o modelo atual. A cláusula de segurança é adicionada quando a quantidade de fogos for maior que zero.</p></section>
    <button className="contract-submit" type="submit" disabled={pending}>{pending ? <><LoaderCircle size={17} className="spin"/> Gerando DOCX…</> : <><FileText size={17}/> Gerar contrato DOCX</>}</button>
    {result && (result.ok ? <div className="contract-success"><strong>Contrato gerado.</strong><span>{result.name}</span><div className="contract-links"><a href={result.documentUrl} target="_blank" rel="noreferrer"><FileDown size={16}/> Baixar contrato DOCX</a></div></div> : <div className="contract-error">{result.message}</div>)}
  </form>;
}
