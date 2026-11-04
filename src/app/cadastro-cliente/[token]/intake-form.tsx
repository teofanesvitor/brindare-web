"use client";

import { useState } from "react";
import { submitClientIntake } from "@/actions/operations";

function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
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

function capitalizeWords(value: string) {
  return value.toLocaleLowerCase("pt-BR").replace(/(^|\s|[-'])\p{L}/gu, (match) => match.toLocaleUpperCase("pt-BR"));
}

export function IntakeForm({ token, defaults = {} }: { token: string; defaults?: Record<string, string> }) {
  const [cpf, setCpf] = useState(maskCpf(defaults.cpf || ""));
  const [cpfError, setCpfError] = useState("");
  function checkCpf() {
    const valid = validCpf(cpf);
    setCpfError(valid ? "" : "Informe um CPF válido.");
    return valid;
  }
  function capitalize(event: React.FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (input.name !== "email" && input.type !== "date" && input.type !== "time" && input.name !== "cpf" && input.name !== "phone") {
      input.value = capitalizeWords(input.value);
    }
  }
  return <form action={submitClientIntake} className="operation-form" onSubmit={(event) => {
    if (!checkCpf()) { event.preventDefault(); }
  }}>
    <input type="hidden" name="token" value={token}/>
    <label>Nome completo *<input name="full_name" required minLength={3} autoComplete="name" defaultValue={defaults.full_name || ""} onBlur={capitalize}/></label>
    <label>Telefone / WhatsApp *<input name="phone" required autoComplete="tel" inputMode="tel" placeholder="(00) 00000-0000" defaultValue={defaults.phone || ""}/></label>
    <label>E-mail *<input name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={defaults.email || ""}/></label>
    <label>CPF *<input name="cpf" required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} onChange={(event) => {setCpf(maskCpf(event.target.value));setCpfError("");}} onBlur={checkCpf} aria-invalid={!!cpfError}/>{cpfError && <small className="field-error">{cpfError}</small>}</label>
    <label>RG<input name="rg" defaultValue={defaults.rg || ""} onBlur={capitalize}/></label>
    <label>Endereço *</label>
    <label className="full-width"><input name="address" required autoComplete="street-address" defaultValue={defaults.address || ""} onBlur={capitalize} placeholder="Rua, número e complemento"/></label>
    <label>Bairro<input name="neighborhood" defaultValue={defaults.neighborhood || ""} onBlur={capitalize}/></label>
    <label>Município<input name="city" defaultValue={defaults.city || "Maceió"} onBlur={capitalize}/></label>
    <label>Data do evento *<input name="event_date" type="date" required defaultValue={defaults.event_date || ""}/></label>
    <label>Horário do evento *<input name="event_time" type="time" required defaultValue={defaults.event_time || ""}/></label>
    <label>Horário do brinde<input name="toast_time" type="time" defaultValue={defaults.toast_time || ""}/></label>
    <label>Local do evento *<input name="venue" required placeholder="Espaço ou endereço" defaultValue={defaults.venue || ""} onBlur={capitalize}/></label>
    <label>Cerimonial<input name="ceremony_contact" defaultValue={defaults.ceremony_contact || ""} onBlur={capitalize}/></label>
    <label>Indicação<input name="referral" placeholder="Como conheceu a Brindare?" defaultValue={defaults.referral || ""} onBlur={capitalize}/></label>
    <button className="operation-submit" type="submit">Enviar meus dados</button>
  </form>;
}
