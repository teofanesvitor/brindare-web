"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

export function IntakeLinkActions({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copyLink() {
    const absoluteLink = new URL(link, window.location.origin).toString();
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(absoluteLink);
      } else {
        throw new Error("Clipboard API indisponível neste contexto.");
      }
      setCopied(true);
      setError("");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = absoluteLink;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      fallback.setSelectionRange(0, fallback.value.length);
      const success = document.execCommand("copy");
      document.body.removeChild(fallback);
      if (success) {
        setCopied(true);
        setError("");
        window.setTimeout(() => setCopied(false), 2500);
      } else {
        setCopied(false);
        setError("Não foi possível copiar automaticamente. Selecione o endereço e copie manualmente.");
      }
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
