import { CalendarDays, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "@/actions/operations";

const money = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
const date = (v: string) => new Date(`${v}T12:00:00`).toLocaleDateString("pt-BR");

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data: events, error } = await supabase.from("events")
    .select("id,client_name,event_date,event_time,venue,package_name,total_cents,deposit_cents,balance_cents,status,glasses,fireworks,sparkles,tables,champagne")
    .gte("event_date", new Date().toISOString().slice(0,10))
    .neq("status", "Cancelado").order("event_date", { ascending: true }).limit(100);
  return <main className="content">
    <div className="page-heading"><div><div className="eyebrow">Operação</div><h1>Próximos eventos</h1><p>Agenda operacional e financeira dos eventos da Brindare.</p></div></div>
    <section className="operation-panel">
      <div className="operation-title"><div><h2><Plus size={17}/> Novo evento</h2><p>Cadastre os dados principais e os itens previstos para cada celebração.</p></div></div>
      <form action={createEvent} className="operation-form">
        <label>Cliente *<input name="client_name" required placeholder="Nome do cliente"/></label>
        <label>Data *<input name="event_date" type="date" required/></label>
        <label>Horário<input name="event_time" type="time"/></label>
        <label>Local *<input name="venue" required placeholder="Espaço do evento"/></label>
        <label>Cerimonial<input name="ceremony_contact"/></label>
        <label>Indicação<input name="referral"/></label>
        <label>Pacote *<input name="package_name" required placeholder="Essencial, Celebração, Luxo..."/></label>
        <label>Status<select name="status" defaultValue="A pagar"><option>A pagar</option><option>Confirmado</option><option>Pago</option><option>Realizado</option><option>Cancelado</option></select></label>
        <label>Valor total (R$)<input name="total" type="number" min="0" step="0.01" defaultValue="0"/></label>
        <label>Entrada (R$)<input name="deposit" type="number" min="0" step="0.01" defaultValue="0"/></label>
        <label>Deslocamento (R$)<input name="travel" type="number" min="0" step="0.01" defaultValue="0"/></label>
        <label>Taças<input name="glasses" type="number" min="0" step="1" defaultValue="0"/></label>
        <label>Fogos (pares)<input name="fireworks" type="number" min="0" step="1" defaultValue="0"/></label>
        <label>Sparkles<input name="sparkles" type="number" min="0" step="1" defaultValue="0"/></label>
        <label>Mesas<input name="tables" type="number" min="0" step="1" defaultValue="0"/></label>
        <label>Champanhe<input name="champagne" type="number" min="0" step="1" defaultValue="0"/></label>
        <button className="operation-submit" type="submit">Salvar evento</button>
      </form>
    </section>
    <section className="operation-panel">
      <div className="operation-title"><div><h2><CalendarDays size={17}/> Agenda futura</h2><p>{events?.length ?? 0} evento(s) futuro(s), ordenados por data.</p></div></div>
      {error ? <p className="operation-empty">Não foi possível carregar os eventos. Verifique se a migration de agenda foi aplicada.</p> : !events?.length ? <p className="operation-empty">Nenhum evento futuro cadastrado.</p> : <div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Data / hora</th><th>Cliente</th><th>Local</th><th>Pacote</th><th>Itens</th><th>Valor</th><th>Saldo</th><th>Status</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td><strong>{date(e.event_date)}</strong><small>{e.event_time?.slice(0,5) || "Horário a definir"}</small></td><td>{e.client_name}</td><td>{e.venue}</td><td>{e.package_name}</td><td><small>Taças {e.glasses} · Fogos {e.fireworks} · Sparkles {e.sparkles} · Mesa {e.tables} · Champ. {e.champagne}</small></td><td>{money(e.total_cents)}</td><td>{money(e.balance_cents)}</td><td><span className={`status-pill status-${e.status.toLowerCase().replaceAll(" ","-")}`}>{e.status}</span></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
