"use client";

import { useState, useTransition, type FocusEvent, type ChangeEvent } from "react";
import { FileText, FileDown, LoaderCircle } from "lucide-react";
import { generateContractAction, type ContractActionResult } from "@/actions/contracts";

type InitialData = {
  clientId?: string; client?: string; cpf?: string; rg?: string; phone?: string; email?: string;
  address?: string; neighborhood?: string; city?: string; eventDate?: string; eventTime?: string;
  toastTime?: string; venue?: string;
};
type FieldProps = { label: string; name: string; type?: string; required?: boolean; defaultValue?: string | number; min?: string; step?: string };

function maskCpf(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
}
function capitalizeWords(value: string) {
  return value.toLocaleLowerCase("pt-BR").replace(/(^|\s|[-'])\p{L}/gu, (match) => match.toLocaleUpperCase("pt-BR"));
}
function formatDateBr(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(8, 10) + "/" + value.slice(5, 7) + "/" + value.slice(0, 4);
  return value;
}
function dateBrToIso(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return "";
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)
    ? `${year}-${month}-${day}` : "";
}
function Field({ label, name, type = "text", required = false, defaultValue = "", min, step }: FieldProps) {
  const isCpf = name === "cpf", isPhone = name === "phone";
  const isDate = type === "date", isTime = type === "time";
  const digitsOnly = isCpf || isPhone;
  const maxLength = isCpf ? 14 : isPhone ? 16 : isDate ? 10 : isTime ? 5 : undefined;
  const [formattedValue, setFormattedValue] = useState(() => isDate ? formatDateBr(String(defaultValue)) : String(defaultValue));
  function capitalize(event: FocusEvent<HTMLInputElement>) {
    if (!["email", "cpf", "phone", "rg"].includes(name) && !isDate && !isTime && type !== "number") {
      event.currentTarget.value = capitalizeWords(event.currentTarget.value);
    }
  }
  function formatDigits(event: ChangeEvent<HTMLInputElement>) {
    if (isCpf) event.currentTarget.value = maskCpf(event.currentTarget.value);
    if (isPhone) event.currentTarget.value = maskPhone(event.currentTarget.value);
    if (isDate) {
      const digits = event.currentTarget.value.replace(/\D/g, "").slice(0, 8);
      const value = digits.length > 4 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
        : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
      setFormattedValue(value);
      event.currentTarget.value = value;
    }
    if (isTime) {
      const digits = event.currentTarget.value.replace(/\D/g, "").slice(0, 4);
      const value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
      setFormattedValue(value);
      event.currentTarget.value = value;
    }
  }
  const initialDigits = String(defaultValue);
  const initialValue = isCpf ? maskCpf(initialDigits) : isPhone ? maskPhone(initialDigits) : defaultValue;
  const isoDate = isDate ? dateBrToIso(formattedValue) : "";
  const validTime = isTime && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(formattedValue);
  return <label className="contract-field"><span>{label}{required ? " *" : ""}</span>
    {isDate || isTime ? <>
      <input type="text" inputMode={isDate ? "numeric" : "decimal"} maxLength={maxLength} required={required}
        value={formattedValue} onChange={formatDigits} placeholder={isDate ? "DD/MM/AAAA" : "HH:MM"}
        pattern={isDate ? "[0-9]{2}/[0-9]{2}/[0-9]{4}" : "(?:[01][0-9]|2[0-3]):[0-5][0-9]"}
        title={isDate ? "Use o formato DD/MM/AAAA." : "Use o formato 24 horas HH:MM."}/>
      <input type="hidden" name={name} value={isDate ? isoDate : validTime ? formattedValue : ""}/>
    </> : <input name={name} type={digitsOnly ? "text" : type} inputMode={digitsOnly ? "numeric" : undefined} maxLength={maxLength} required={required} defaultValue={initialValue} min={min} step={step} placeholder={isCpf ? "000.000.000-00" : isPhone ? "(00) 9 0000-0000" : undefined} onChange={formatDigits} onBlur={capitalize}/>}
  </label>;
}

const packagePrices: Record<string, number> = { "Essencial": 450, "Celebração": 650, "Luxo": 900 };
const centsToNumber = (cents: number) => (cents / 100).toFixed(2);
const formatCurrency = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function parseCurrencyInput(value: string): number {
  const raw = value.replace(/R\$|\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

function MoneyField({ label, name, cents, onChange }: { label: string; name: string; cents: number; onChange: (value: number) => void }) {
  return <label className="contract-field"><span>{label}</span>
    <input type="text" inputMode="decimal" required={name === "deposit"} value={formatCurrency(cents)} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(parseCurrencyInput(event.currentTarget.value))}/>
    <input type="hidden" name={name} value={centsToNumber(cents)}/>
  </label>;
}

export function ContractForm({ initialData = {} }: { initialData?: InitialData }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ContractActionResult | null>(null);
  const [packageName, setPackageName] = useState("");
  const [travelCents, setTravelCents] = useState(0);
  const [depositCents, setDepositCents] = useState(0);
  const [depositEdited, setDepositEdited] = useState(false);
  const packageCents = (packagePrices[packageName] || 0) * 100;
  const totalCents = packageCents + travelCents;
  const effectiveDepositCents = depositEdited ? depositCents : Math.round(totalCents / 2);
  const balanceCents = Math.max(0, totalCents - effectiveDepositCents);

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
      <label className="contract-field"><span>Pacote *</span><select name="packageName" required value={packageName} onChange={(event) => setPackageName(event.target.value)}>
        <option value="">Selecione o pacote</option><option value="Celebração">Celebração — R$ 650,00</option><option value="Essencial">Essencial — R$ 450,00</option><option value="Luxo">Luxo — R$ 900,00</option>
      </select></label>
    </div></section>
    <section className="contract-panel"><h2>Dados do contratante</h2><div className="contract-grid">
      <Field label="Nome completo" name="client" required defaultValue={initialData.client || ""}/>
      <Field label="CPF" name="cpf" required defaultValue={initialData.cpf || ""}/>
      <Field label="RG" name="rg" defaultValue={initialData.rg || ""}/>
      <Field label="Celular" name="phone" defaultValue={initialData.phone || ""}/>
      <Field label="E-mail" name="email" type="email" defaultValue={initialData.email || ""}/>
      <Field label="Endereço" name="address" required defaultValue={initialData.address || ""}/>
      <Field label="Bairro" name="neighborhood" defaultValue={initialData.neighborhood || ""}/>
      <Field label="Município" name="city" defaultValue={initialData.city || ""}/>
    </div></section>
    <section className="contract-panel"><h2>Valores</h2><div className="contract-grid">
      <label className="contract-field"><span>Valor do pacote</span><input type="text" readOnly value={packageName ? formatCurrency(packageCents) : "Selecione um pacote"}/></label>
      <MoneyField label="Deslocamento" name="travel" cents={travelCents} onChange={setTravelCents}/>
      <label className="contract-field"><span>Valor total (pacote + deslocamento)</span><input type="text" readOnly value={formatCurrency(totalCents)}/><input type="hidden" name="total" value={centsToNumber(totalCents)}/></label>
      <MoneyField label="Entrada *" name="deposit" cents={effectiveDepositCents} onChange={(value) => { setDepositCents(value); setDepositEdited(true); }}/>
      <label className="contract-field"><span>Restante (calculado automaticamente)</span><input type="text" readOnly value={formatCurrency(balanceCents)}/><input type="hidden" name="balance" value={centsToNumber(balanceCents)}/></label>
    </div><p className="contract-hint">Total = pacote + deslocamento. Entrada padrão: 50% do total; saldo = total − entrada.</p></section>
    <section className="contract-panel"><h2>Itens do pacote</h2><div className="contract-grid">
      <Field label="Mesa de apoio (0 = não incluir)" name="mesa" type="number" min="0" step="1" defaultValue="0"/>
      <label className="contract-field"><span>Taças de vidro (quantidade)</span><input name="tacas" type="number" min="0" step="1" list="glass-quantities" defaultValue="0"/><datalist id="glass-quantities"><option value="30"/><option value="55"/><option value="90"/></datalist></label>
      <Field label="Pares de fogos indoor" name="fogos" type="number" min="0" step="1" defaultValue="0"/>
      <Field label="Sparkles" name="sparkles" type="number" min="0" step="1" defaultValue="0"/>
      <Field label="Unidades de champanhe" name="champagne" type="number" min="0" step="1" defaultValue="0"/>
    </div><p className="contract-hint">Quantidades padrão de taças: 30, 55 ou 90 unidades.</p></section>
    <button className="contract-submit" type="submit" disabled={pending}>{pending ? <><LoaderCircle size={17} className="spin"/> Gerando DOCX…</> : <><FileText size={17}/> Gerar contrato DOCX</>}</button>
    {result && (result.ok ? <div className="contract-success"><strong>Contrato gerado.</strong><span>{result.name}</span><div className="contract-links"><a href={result.documentUrl} download={`${result.name}.docx`}><FileDown size={16}/> Baixar contrato DOCX</a></div></div> : <div className="contract-error">{result.message}</div>)}
  </form>;
}
