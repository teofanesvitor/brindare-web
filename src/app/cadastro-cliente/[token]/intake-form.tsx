"use client";

import { useEffect, useState } from "react";
import { submitClientIntake, submitPublicClientIntake } from "@/actions/operations";

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

function DateTimeInput({ label, name, type, required = false, defaultValue = "" }: {
  label: string; name: string; type: "date" | "time"; required?: boolean; defaultValue?: string;
}) {
  return <label>{label}
    <input
      type={type}
      name={name}
      required={required}
      defaultValue={defaultValue}
      lang="pt-BR"
      step={type === "date" ? 1 : 60}
      autoComplete="off"
      aria-label={label}
    />
    <small>{type === "date" ? "Selecione a data no calendário." : "Selecione o horário no formato 24 horas."}</small>
  </label>;
}

function capitalizeWords(value: string) {
  return value.toLocaleLowerCase("pt-BR").replace(/(^|\s|[-'])\p{L}/gu, (match) => match.toLocaleUpperCase("pt-BR"));
}

export function IntakeForm({ token, defaults = {} }: { token?: string; defaults?: Record<string, string> }) {
  const [cpf, setCpf] = useState(maskCpf(defaults.cpf || ""));
  const [phone, setPhone] = useState(maskPhone(defaults.phone || ""));
  const [cpfError, setCpfError] = useState("");
  const [startedAt, setStartedAt] = useState("");
  useEffect(() => { setStartedAt(Date.now().toString()); }, []);
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
  return <form action={token ? submitClientIntake : submitPublicClientIntake} className="operation-form" onSubmit={(event) => {
    if (!checkCpf()) { event.preventDefault(); }
  }}>
    {token && <input type="hidden" name="token" value={token}/>}
    <input type="hidden" name="form_started_at" value={startedAt}/>
    <label className="intake-honeypot" aria-hidden="true">Não preencha este campo<input name="company_website" tabIndex={-1} autoComplete="off"/></label>
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
