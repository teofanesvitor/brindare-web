import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserRoundCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { convertIntakeToClient } from "@/actions/operations";

export default async function ReviewClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: intake, error } = await supabase.from("client_intakes")
    .select("id,status,payload,submitted_at").eq("id", id).single();
  if (error || !intake || intake.status !== "submitted") notFound();
  const p = (intake.payload || {}) as Record<string,string>;
  return <main className="content">
    <div className="page-heading"><div><div className="eyebrow">Clientes · Revisão</div><h1>Conferir pré-cadastro</h1><p>Revise os dados enviados pelo cliente e complete o cadastro administrativo.</p></div><Link className="operation-link" href="/clientes"><ArrowLeft size={15}/> Voltar</Link></div>
    <section className="operation-panel"><div className="operation-title"><div><h2><UserRoundCheck size={17}/> Dados enviados</h2><p>Recebido em {intake.submitted_at ? new Date(intake.submitted_at).toLocaleString("pt-BR") : "—"}</p></div></div>
      <form action={convertIntakeToClient} className="operation-form">
        <input type="hidden" name="intake_id" value={intake.id}/>
        <label>Nome completo *<input name="full_name" required defaultValue={p.full_name || ""}/></label>
        <label>CPF *<input name="cpf" required inputMode="numeric" defaultValue={p.cpf || ""}/></label>
        <label>RG<input name="rg" defaultValue={p.rg || ""}/></label>
        <label>Telefone<input name="phone" defaultValue={p.phone || ""}/></label>
        <label>E-mail<input name="email" type="email" defaultValue={p.email || ""}/></label>
        <label>Endereço *<input name="address" required defaultValue={p.address || ""}/></label>
        <label>Bairro<input name="neighborhood" defaultValue={p.neighborhood || ""}/></label>
        <label>Município<input name="city" defaultValue={p.city || ""}/></label>
        <div className="intake-event-summary"><strong>Informações do evento enviadas</strong><span>Data: {p.event_date || "Não informada"} · Horário: {p.event_time || "Não informado"} · Brinde: {p.toast_time || "Não informado"}</span><span>Local: {p.venue || "Não informado"} · Cerimonial: {p.ceremony_contact || "Não informado"}</span><span>Indicação: {p.referral || "Não informada"}</span></div>
        <button className="operation-submit" type="submit">Finalizar cadastro e preparar contrato</button>
      </form>
    </section>
  </main>;
}
