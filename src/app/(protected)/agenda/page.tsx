import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateEventStatus } from "@/actions/operations";

const money = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);

const date = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

export default async function AgendaPage() {
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA");

  // A agenda é alimentada exclusivamente pelos contratos gerados.
  // O vínculo é criado em generateContractAction, após salvar o contrato.
  const { data: events, error } = await supabase
    .from("events")
    .select(
      "id,contract_id,client_name,event_date,event_time,toast_time,venue,package_name,total_cents,balance_cents,travel_cents,status,glasses,fireworks,sparkles,tables,champagne"
    )
    .not("contract_id", "is", null)
    .gte("event_date", today)
    .neq("status", "Cancelado")
    .order("event_date", { ascending: true })
    .limit(100);

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Operação</div>
          <h1>Agenda</h1>
          <p>Eventos futuros originados dos contratos gerados pela Brindare.</p>
        </div>
      </div>

      <section className="operation-panel">
        <div className="operation-title">
          <div>
            <h2><CalendarDays size={17} /> Agenda futura</h2>
            <p>{events?.length ?? 0} evento(s) futuro(s), vinculados a contratos e ordenados por data.</p>
          </div>
        </div>

        {error ? (
          <p className="operation-empty">
            Não foi possível carregar a agenda. Verifique se as migrations de contratos e eventos foram aplicadas.
          </p>
        ) : !events?.length ? (
          <p className="operation-empty">
            Nenhum evento futuro encontrado. Os eventos aparecerão aqui automaticamente após a geração de um contrato.
          </p>
        ) : (
          <div className="operation-table-wrap">
            <table className="operation-table">
              <thead>
                <tr>
                  <th>Data / hora</th>
                  <th>Cliente</th>
                  <th>Local</th>
                  <th>Pacote</th>
                  <th>Itens</th>
                  <th>Valor</th>
                  <th>Deslocamento</th>
                  <th>Saldo</th>
                  <th>Status</th>
                  <th>Atualizar</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{date(event.event_date)}</strong>
                      <small>Evento: {event.event_time?.slice(0, 5) || "A definir"} · Brinde: {event.toast_time?.slice(0, 5) || "A definir"}</small>
                    </td>
                    <td>{event.client_name}</td>
                    <td>{event.venue}</td>
                    <td>{event.package_name}</td>
                    <td>
                      <small>
                        Taças {event.glasses} · Fogos {event.fireworks} · Sparkles {event.sparkles} · Mesa {event.tables} · Champ. {event.champagne}
                      </small>
                    </td>
                    <td>{money(event.total_cents)}</td>
                    <td>{money(event.travel_cents || 0)}</td>
                    <td>{money(event.balance_cents)}</td>
                    <td>
                      <span className={`status-pill status-${event.status.toLowerCase().replaceAll(" ", "-")}`}>
                        {event.status}
                      </span>
                    </td>
                    <td>
                      <form action={updateEventStatus} className="event-status-form">
                        <input type="hidden" name="event_id" value={event.id} />
                        <select name="status" defaultValue={event.status}>
                          <option>A pagar</option>
                          <option>Confirmado</option>
                          <option>Pago</option>
                          <option>Realizado</option>
                          <option>Cancelado</option>
                        </select>
                        <button type="submit">Salvar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
