"use client";

import { useState } from "react";
import { submitClientIntake } from "@/actions/operations";

function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
}

function validCpf(value: string) {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (base: string, factor: number) => {
    let sum = 0;
    for (const char of base) sum += Number(char) * factor--;
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(cpf.slice(0, 9), 10) === Number(cpf[9]) && digit(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

function formatDateBr(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value;
}
function dateBrToIso(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return "";
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)
    ? `${year}-${month}-${day}` : "";
}
function DateTimeInput({ label, name, type, required = false, defaultValue = "" }: {
  label: string; name: string; type: "date" | "time"; required?: boolean; defaultValue?: string;
}) {
  const [value, setValue] = useState(() => type === "date" ? formatDateBr(defaultValue) : defaultValue);
  const isDate = type === "date";
  const isoDate = isDate ? dateBrToIso(value) : "";
  const validTime = !isDate && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  function update(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, isDate ? 8 : 4);
    setValue(isDate
      ? digits.length > 4 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
        : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
      : digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
  }
  return <label>{label}<input type="text" inputMode="numeric" value={value} onChange={event => update(event.target.value)}
    placeholder={isDate ? "DD/MM/AAAA" : "HH:MM"} maxLength={isDate ? 10 : 5} required={required}
    pattern={isDate ? "\d{2}/\d{2}/\d{4}" : "(?:[01]\d|2[0-3]):[0-5]\d"}
    title={isDate ? "Use o formato DD/MM/AAAA." : "Use o formato 24 horas HH:MM."}/>
    <input type="hidden" name={name} value={isDate ? isoDate : validTime ? value : ""}/>
  </label>;
}

function capitalizeWords(value: string) {
  return value.toLocaleLowerCase("pt-BR").replace(/(^|\s|[-'])\p{L}/gu, (match) => match.toLocaleUpperCase("pt-BR"));
}

export function IntakeForm({ token, defaults = {} }: { token: string; defaults?: Record<string, string> }) {
  const [cpf, setCpf] = useState(maskCpf(defaults.cpf || ""));
  const [phone, setPhone] = useState(maskPhone(defaults.phone || ""));
  const [cpfError, setCpfError] = useState("");
  function checkCpf() {
    const valid = validCpf(cpf);
    setCpfError(valid ? "" : "Informe um CPF válido.");
    return valid;
  }
  function capitalize(event: React.FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (input.name !== "email" && input.type !== "date" && input.type !== "time" && input.name !== "cpf" && input.name !== "phone" && input.name !== "rg") {
      input.value = capitalizeWords(input.value);
    }
  }
  return <form action={submitClientIntake} className="operation-form" onSubmit={(event) => {
    if (!checkCpf()) { event.preventDefault(); }
  }}>
    <input type="hidden" name="token" value={token}/>
    <label>Nome completo *<input name="full_name" required minLength={3} autoComplete="name" defaultValue={defaults.full_name || ""} onBlur={capitalize}/></label>
    <label>Celular / WhatsApp *<input name="phone" required autoComplete="tel" inputMode="numeric" maxLength={16} placeholder="(00) 9 0000-0000" value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))}/></label>
    <label>E-mail *<input name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={defaults.email || ""}/></label>
    <label>CPF *<input name="cpf" required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} onChange={(event) => {setCpf(maskCpf(event.target.value));setCpfError("");}} onBlur={checkCpf} aria-invalid={!!cpfError}/>{cpfError && <small className="field-error">{cpfError}</small>}</label>
    <label>RG<input name="rg" defaultValue={defaults.rg || ""} onBlur={capitalize}/></label>
    <label className="full-width">Endereço *<input name="address" required autoComplete="street-address" defaultValue={defaults.address || ""} onBlur={capitalize} placeholder="Rua, número e complemento"/></label>
    <label>Bairro<input name="neighborhood" defaultValue={defaults.neighborhood || ""} onBlur={capitalize}/></label>
    <label>Município<input name="city" defaultValue={defaults.city || "Maceió"} onBlur={capitalize}/></label>
    <DateTimeInput label="Data do evento *" name="event_date" type="date" required defaultValue={defaults.event_date || ""}/>
    <DateTimeInput label="Horário do evento *" name="event_time" type="time" required defaultValue={defaults.event_time || ""}/>
    <DateTimeInput label="Horário do brinde" name="toast_time" type="time" defaultValue={defaults.toast_time || ""}/>
    <label>Local do evento *<input name="venue" required placeholder="Espaço ou endereço" defaultValue={defaults.venue || ""} onBlur={capitalize}/></label>
    <label>Cerimonial<input name="ceremony_contact" defaultValue={defaults.ceremony_contact || ""} onBlur={capitalize}/></label>
    <label>Indicação<input name="referral" placeholder="Como conheceu a Brindare?" defaultValue={defaults.referral || ""} onBlur={capitalize}/></label>
    <button className="operation-submit" type="submit">Enviar meus dados</button>
  </form>;
}
