import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { markInventoryInstallmentPaid } from "@/actions/operations";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const monthKey = (value: string) => value.slice(0, 7);
const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
};
type SearchParams = Promise<{ installment?: string }>;

export default async function FinanceiroPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: installments, error } = await supabase
    .from("inventory_purchase_installments")
    .select("id,installment_number,amount_cents,due_date,status,paid_at,inventory_purchases(id,purchase_date,payment_method,installments,description,inventory_items(name,unit))")
    .order("due_date", { ascending: true })
    .limit(500);

  const rows = (installments ?? []) as unknown as {
    id: string; installment_number: number; amount_cents: number; due_date: string; status: string; paid_at: string | null;
    inventory_purchases: {
      id: string; purchase_date: string; payment_method: string; installments: number; description: string | null;
      inventory_items: { name: string; unit: string } | null;
    } | null;
  }[];
  const today = new Date().toLocaleDateString("en-CA");
  const currentMonth = today.slice(0, 7);
  const planned = rows.filter(row => row.status === "prevista");
  const paid = rows.filter(row => row.status === "paga");
  const overdue = planned.filter(row => row.due_date < today);
  const currentRows = rows.filter(row => monthKey(row.due_date) === currentMonth);
  const currentTotal = currentRows.reduce((sum, row) => sum + Number(row.amount_cents), 0);
  const currentPaid = currentRows.filter(row => row.status === "paga").reduce((sum, row) => sum + Number(row.amount_cents), 0);
  const currentPending = currentTotal - currentPaid;
  const futureGroups = new Map<string, { total: number; paid: number; pending: number }>();
  rows.filter(row => monthKey(row.due_date) > currentMonth).forEach(row => {
    const key = monthKey(row.due_date);
    const group = futureGroups.get(key) ?? { total: 0, paid: 0, pending: 0 };
    group.total += Number(row.amount_cents);
    if (row.status === "paga") group.paid += Number(row.amount_cents);
    else group.pending += Number(row.amount_cents);
    futureGroups.set(key, group);
  });
  return <main className="content">
    <div className="page-heading"><div><div className="eyebrow">Financeiro</div><h1>Fluxo de caixa</h1><p>Planejamento mensal das despesas com recursos e compras de estoque.</p></div></div>
    {params.installment === "paid" && <p className="operation-success">Parcela marcada como paga.</p>}
    <section className="operation-panel">
      <div className="operation-title"><div><h2><CalendarClock size={17}/> Reserva de recursos — {monthLabel(currentMonth)}</h2><p>Valor a destinar neste mês, independentemente do vencimento real do cartão.</p></div></div>
      <section className="agenda-finance-summary">
        <article><span>Previsto no mês</span><strong>{money(currentTotal)}</strong></article>
        <article><span>Já pago</span><strong>{money(currentPaid)}</strong></article>
        <article><span>Ainda precisa reservar</span><strong>{money(currentPending)}</strong></article>
      </section>
      <p className="operation-hint">As compras parceladas começam a compor a reserva no mês seguinte à compra. Cada parcela é alocada no primeiro dia do mês correspondente; pagamentos antecipados reduzem o saldo a reservar daquele mês.</p>
    </section>
    <section className="operation-panel">
      <div className="operation-title"><div><h2>Compromissos dos próximos meses</h2><p>Parcelas futuras já contratadas.</p></div></div>
      {!futureGroups.size ? <p className="operation-empty">Nenhum compromisso futuro registrado.</p> : <div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Mês</th><th>Total previsto</th><th>Pago</th><th>A reservar</th></tr></thead><tbody>{Array.from(futureGroups.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([key, group])=><tr key={key}><td>{monthLabel(key)}</td><td>{money(group.total)}</td><td>{money(group.paid)}</td><td><strong>{money(group.pending)}</strong></td></tr>)}</tbody></table></div>}
    </section>
    <section className="agenda-finance-summary">
      <article><span>Parcelas previstas (geral)</span><strong>{money(planned.reduce((sum,row)=>sum+Number(row.amount_cents),0))}</strong></article>
      <article><span>Parcelas vencidas</span><strong>{money(overdue.reduce((sum,row)=>sum+Number(row.amount_cents),0))}</strong></article>
      <article><span>Parcelas quitadas (geral)</span><strong>{money(paid.reduce((sum,row)=>sum+Number(row.amount_cents),0))}</strong></article>
    </section>
    <section className="operation-panel">
      <div className="operation-title"><div><h2><CalendarClock size={17}/> Lançamentos de compras</h2><p>Parcelas distribuídas por competência mensal, começando no mês seguinte à compra.</p></div></div>
      {error ? <p className="operation-empty">Não foi possível carregar o fluxo de caixa. Verifique a migration de compras de estoque.</p> : !rows.length ? <p className="operation-empty">Nenhuma compra registrada.</p> : <div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Competência</th><th>Produto</th><th>Forma de pagamento</th><th>Parcela</th><th>Valor</th><th>Situação</th><th>Descrição</th><th>Ação</th></tr></thead><tbody>{rows.map(row => {
        const purchase = row.inventory_purchases;
        return <tr key={row.id}><td>{monthLabel(monthKey(row.due_date))}</td><td>{purchase?.inventory_items?.name ?? "Item removido"}</td><td>{purchase?.payment_method ?? "—"}</td><td>{row.installment_number}/{purchase?.installments ?? 1}</td><td><strong>{money(Number(row.amount_cents))}</strong></td><td><span className={`status-pill ${row.status === "paga" ? "status-pago" : row.due_date < today ? "status-cancelado" : "status-a-pagar"}`}>{row.status === "paga" ? "Paga" : "A reservar"}</span></td><td>{purchase?.description || "Compra de estoque"}</td><td>{row.status === "prevista" ? <form action={markInventoryInstallmentPaid}><input type="hidden" name="installment_id" value={row.id}/><button className="operation-link" type="submit">Marcar como paga</button></form> : <small>Pago em {row.paid_at ? date(row.paid_at) : "na compra"}</small>}</td></tr>;
      })}</tbody></table></div>}
    </section>
    <p className="operation-hint">Esta tela consolida despesas originadas por compras de estoque. Receitas de eventos continuam disponíveis na Agenda; a consolidação geral de receitas e despesas será uma etapa separada.</p>
  </main>;
}
