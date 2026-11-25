"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteClientIntake } from "@/actions/client-intakes";

type Props = {
  intakeId: string;
  status: string;
  name: string;
  email: string;
  phone: string;
  receivedAt: string;
};

export function IntakeNotification({ intakeId, status, name, email, phone, receivedAt }: Props) {
  const [revealed, setRevealed] = useState(false);
  const touchStart = useRef<number | null>(null);
  const unreviewed = status === "submitted" || status === "pending" || status === "created";
  const confirmMessage = unreviewed
    ? "Esta solicitação ainda não foi revisada. Ao excluir, todos os dados enviados pelo cliente e a notificação serão perdidos permanentemente. Deseja continuar?"
    : "Excluir permanentemente esta notificação? O cadastro do cliente, o contrato e o evento já gerados serão preservados.";

  return <div className={`intake-swipe ${revealed ? "is-revealed" : ""}`}
    onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
    onTouchEnd={(event) => {
      const end = event.changedTouches[0]?.clientX;
      if (touchStart.current !== null && end !== undefined) {
        const delta = end - touchStart.current;
        if (delta < -45) setRevealed(true);
        if (delta > 45) setRevealed(false);
      }
      touchStart.current = null;
    }}>
    <div className="intake-delete-reveal">
      <form action={deleteClientIntake} onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}>
        <input type="hidden" name="intake_id" value={intakeId}/>
        <button type="submit" aria-label="Excluir solicitação" title="Excluir solicitação"><Trash2 size={19}/></button>
      </form>
    </div>
    <article className="intake-row intake-swipe-content">
      <div>
        <strong>{name}</strong>
        <span>{email} · {phone}</span>
        <small>Recebido em {receivedAt}</small>
      </div>
      <div className="intake-actions">
        <span className={`status-pill status-${status}`}>{status === "submitted" ? "Recebido" : status === "converted" ? "Convertido" : status === "expired" ? "Expirado" : "Aguardando"}</span>
        {status === "submitted" && <Link className="operation-link" href={`/clientes/${intakeId}`}>Revisar cadastro</Link>}
      </div>
    </article>
  </div>;
}
