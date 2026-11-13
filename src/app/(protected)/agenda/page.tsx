import { CalendarDays, CircleDollarSign, FileCheck2, FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createEvent, registerEventPayment, uploadSignedEventContract, updateEventStatus } from "@/actions/operations";

const money = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

type SearchParams = Promise<{ status?: string; periodo?: string; payment?: string; signed?: string; created?: string }>;

export default async function AgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA");
  const validStatuses = ["A pagar", "Confirmado", "Pago"];
  const selectedStatus = validStatuses.includes(filters.status || "") ? filters.status : "";
  const period = filters.periodo === "todos" ? "todos" : "futuros";

  let query = supabase.from("events").select(
    "id,contract_id,client_name,event_date,event_time,toast_time,venue,package_name,total_cents,deposit_cents,balance_cents,travel_cents,status,payment_status,glasses,fireworks,sparkles,tables,champagne,event_payments(amount_cents,paid_at,payment_method,notes),event_signed_contracts(id,storage_path,original_file_name,signed_at,created_at)"
  ).neq("status", "Cancelado").order("event_date", { ascending: true }).limit(200);

  if (period === "futuros") query = query.gte("event_date", today);
  if (selectedStatus) query = query.eq("payment_status", selectedStatus);

  const { data: events, error } = await query;
  const rows = await Promise.all((events ?? []).map(async (event) => {
    const payments = (event.event_payments ?? []) as {
      amount_cents: number; paid_at: string; payment_method: string | null; notes: string | null;
    }[];
    const signedContracts = [...((event.event_signed_contracts ?? []) as {
      id: string; storage_path: string; original_file_name: string; signed_at: string; created_at: string;
    }[])].sort((a, b) => new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime());
    const signedContractsWithUrls = await Promise.all(signedContracts.map(async (contract) => {
      const result = await supabase.storage.from("contracts").createSignedUrl(
        contract.storage_path, 3600, { download: contract.original_file_name }
      );
      return { ...contract, url: result.data?.signedUrl ?? null };
    }));
    const latestSigned = signedContractsWithUrls[0] ?? null;
    const received = payments.reduce((sum, payment) => sum + Number(payment.amount_cents), 0);
    return {
      ...event, payments, signedContracts: signedContractsWithUrls, latestSigned,
      received, outstanding: Math.max(0, Number(event.total_cents) - received),
    };
  }));
  const totalReceived = rows.reduce((sum, event) => sum + event.received, 0);
  const totalOutstanding = rows.reduce((sum, event) => sum + event.outstanding, 0);

  return (
    <main className="content">
      <div className="page-heading"><div>
        <h1>Agenda</h1>
        
      </div></div>

      {filters.created === "1" && <p className="operation-success">Evento criado na agenda.</p>}
      <details className="operation-panel agenda-create-event">
        <summary className="agenda-create-summary">+ Adicionar evento sem contrato</summary>
        <form action={createEvent} className="operation-form agenda-create-form">
          <label>Cliente / parceiro<input name="client_name" required placeholder="Nome do parceiro ou responsável"/></label>
          <label>Tipo de evento<input name="package_name" required defaultValue="Parceria"/></label>
          <label>Data<input name="event_date" type="date" required defaultValue={today}/></label>
          <label>Horário<input name="event_time" type="time"/></label>
          <label>Horário do brinde<input name="toast_time" type="time"/></label>
          <label>Local<input name="venue" required placeholder="Local do evento"/></label>
          <label>Valor combinado (R$)<input name="total" type="number" min="0" step="0.01" defaultValue="0"/></label>
          <label>Entrada (R$)<input name="deposit" type="number" min="0" step="0.01" defaultValue="0"/></label>
          <label>Deslocamento (R$)<input name="travel" type="number" min="0" step="0.01" defaultValue="0"/></label>
          <label>Mesas<input name="tables" type="number" min="0" step="1" defaultValue="0"/></label>
          <label>Taças<input name="glasses" type="number" min="0" step="1" defaultValue="0"/></label>
          <label>Pares de fogos<input name="fireworks" type="number" min="0" step="1" defaultValue="0"/></label>
          <label>Sparkles<input name="sparkles" type="number" min="0" step="1" defaultValue="0"/></label>
          <label>Champanhe<input name="champagne" type="number" min="0" step="1" defaultValue="0"/></label>
          <label>Status do evento<select name="status" defaultValue="Confirmado"><option value="Confirmado">Confirmado</option><option value="A pagar">A pagar</option></select></label>
          <label>Contato do cerimonial<input name="ceremony_contact"/></label>
          <label>Indicação<input name="referral"/></label>
          <button className="operation-submit full-width" type="submit">Salvar evento</button>
        </form>
      </details>

      <section className="agenda-finance-summary">
        <article><span>Eventos exibidos</span><strong>{rows.length}</strong></article>
        <article><span>Recebido nestes eventos</span><strong>{money(totalReceived)}</strong></article>
        <article><span>Saldo a receber</span><strong>{money(totalOutstanding)}</strong></article>
      </section>

      <section className="operation-panel">
        <div className="operation-title">
          <div><h2><CalendarDays size={17} /> Eventos</h2>
            </div>
          <form className="agenda-filters" method="get">
            <select name="periodo" defaultValue={period} aria-label="Período">
              <option value="futuros">Próximos eventos</option><option value="todos">Todos os eventos</option>
            </select>
            <select name="status" defaultValue={selectedStatus} aria-label="Status de pagamento">
              <option value="">Todos os status</option><option value="A pagar">A pagar</option>
              <option value="Confirmado">Confirmado</option><option value="Pago">Pago</option>
            </select>
            <button type="submit">Filtrar</button>
          </form>
        </div>

        {filters.payment === "registered" && <p className="operation-success">Recebimento registrado com sucesso.</p>}
        {filters.signed === "uploaded" && <p className="operation-success">Contrato assinado enviado com sucesso.</p>}
        {error ? <p className="operation-empty">
          Não foi possível carregar a agenda. Verifique se as migrations de agenda, pagamentos e contratos assinados foram aplicadas.
        </p> : !rows.length ? <p className="operation-empty">Nenhum evento encontrado para os filtros selecionados.</p> : (
          <div className="operation-table-wrap">
            <table className="operation-table agenda-table">
              <thead><tr>
                <th>Data / hora</th><th>Cliente / parceiro</th><th>Local</th><th>Tipo de evento</th>
                <th>Valor previsto</th><th>Recebido</th><th>Saldo</th><th>Status financeiro</th>
                <th>Execução do evento</th><th>Contrato assinado</th><th>Registrar pagamento</th>
              </tr></thead>
              <tbody>{rows.map((event) => (
                <tr key={event.id}>
                  <td><strong>{date(event.event_date)}</strong><small>Evento: {event.event_time?.slice(0, 5) || "A definir"} · Brinde: {event.toast_time?.slice(0, 5) || "A definir"}</small></td>
                  <td>{event.client_name}{!event.contract_id && <small>Evento sem contrato gerado</small>}</td>
                  <td>{event.venue}</td>
                  <td className="agenda-package-cell">
                    <strong>{event.package_name}</strong>
                    <div className="agenda-item-list">
                      {Number(event.tables) > 0 && <span>Mesa de apoio</span>}
                      {Number(event.glasses) > 0 && <span>{event.glasses} taças de vidro</span>}
                      {Number(event.fireworks) > 0 && <span>{event.fireworks} {Number(event.fireworks) === 1 ? "par" : "pares"} de fogos indoor</span>}
                      {Number(event.sparkles) > 0 && <span>{event.sparkles} {Number(event.sparkles) === 1 ? "sparkle" : "sparkles"}</span>}
                      {Number(event.champagne) > 0 && <span>{event.champagne} {Number(event.champagne) === 1 ? "unidade de champagne" : "unidades de champagne"}</span>}
                      {!Number(event.tables) && !Number(event.glasses) && !Number(event.fireworks) && !Number(event.sparkles) && !Number(event.champagne) && <small>Itens não informados</small>}
                    </div>
                  </td>
                  <td>{money(Number(event.total_cents))}<small>Entrada prevista: {money(Number(event.deposit_cents))}</small></td>
                  <td>{money(event.received)}<small>{event.payments.length} lançamento(s)</small></td>
                  <td><strong>{money(event.outstanding)}</strong></td>
                  <td>{Number(event.total_cents) === 0 ? <span className="status-pill">Sem cobrança</span> : <span className={`status-pill status-${(event.payment_status || "A pagar").toLowerCase().replaceAll(" ", "-")}`}>{event.payment_status || "A pagar"}</span>}</td>
                  <td>
                    <form action={updateEventStatus} className="payment-form">
                      <input type="hidden" name="event_id" value={event.id}/>
                      <select name="status" defaultValue={event.status} aria-label="Situação do evento">
                        <option value="Confirmado">Agendado / confirmado</option>
                        <option value="Realizado">Realizado</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                      <button type="submit">Atualizar evento</button>
                    </form>
                    {event.status === "Realizado" && <small>Consumo de materiais processado.</small>}
                  </td>
                  <td>
                    {event.latestSigned ? <div className="signed-contract-state">
                      <span className="signed-contract-received"><FileCheck2 size={13}/> Recebido</span>
                      <small>Recebido em {date(event.latestSigned.signed_at.slice(0, 10))} · {event.signedContracts.length} versão(ões)</small>
                      {event.signedContracts.map((contract) => contract.url
                        ? <a className="signed-contract-download" key={contract.id} href={contract.url} target="_blank" rel="noreferrer">{contract.original_file_name}</a>
                        : <small key={contract.id}>Arquivo indisponível: {contract.original_file_name}</small>)}
                    </div> : <span className="signed-contract-pending">{event.contract_id ? "Aguardando assinatura" : "Sem contrato gerado"}</span>}
                    <details className="signed-contract-upload">
                      <summary><FileUp size={13}/> {event.latestSigned ? "Enviar nova versão" : "Receber contrato assinado"}</summary>
                      <form action={uploadSignedEventContract} className="signed-contract-form">
                        <input type="hidden" name="event_id" value={event.id}/>
                        <label>Arquivo assinado<input type="file" name="signed_contract" accept=".pdf,.docx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png" required/></label>
                        <small>Envie após conferir as assinaturas das duas partes. PDF, DOCX, JPG ou PNG · até 10 MB. Versões anteriores serão preservadas.</small>
                        <button type="submit">Enviar arquivo</button>
                      </form>
                    </details>
                  </td>
                  <td>{Number(event.total_cents) === 0 ? <span>—</span> : event.outstanding > 0 ? (
                    <details className="payment-details">
                      <summary><CircleDollarSign size={14}/> Lançar recebimento</summary>
                      <form action={registerEventPayment} className="payment-form">
                        <input type="hidden" name="event_id" value={event.id}/>
                        <label>Valor recebido (R$)<input name="amount" type="number" min="0.01" max={(event.outstanding / 100).toFixed(2)} step="0.01" required/></label>
                        <label>Data do recebimento<input name="paid_at" type="date" defaultValue={today} required/></label>
                        <label>Forma de pagamento<select name="payment_method" defaultValue="">
                          <option value="">Não informado</option><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Outro</option>
                        </select></label>
                        <label>Observação<input name="notes" placeholder="Ex.: entrada, parcela final..."/></label>
                        <button type="submit">Salvar pagamento</button>
                      </form>
                    </details>
                  ) : <span className="payment-complete">Quitado</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
