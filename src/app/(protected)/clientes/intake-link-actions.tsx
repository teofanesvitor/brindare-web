"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

export function IntakeLinkActions({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setError("");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setError("Não foi possível copiar automaticamente. Selecione e copie o endereço acima.");
    }
  }

  const message = encodeURIComponent(
    "Olá! Segue o link para preencher seus dados do evento e do contrato da Brindare: " + link
  );

  return <div className="intake-link-actions">
    <button className="operation-submit" type="button" onClick={copyLink}>
      {copied ? <Check size={16}/> : <Copy size={16}/>}
      {copied ? "Link copiado" : "Copiar link"}
    </button>
    <a className="operation-submit intake-whatsapp" href={`https://wa.me/?text=${message}`} target="_blank" rel="noreferrer">
      <MessageCircle size={16}/> Compartilhar pelo WhatsApp
    </a>
    {error && <span className="operation-hint" role="alert">{error}</span>}
  </div>;
}
