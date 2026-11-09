import { CalendarClock, CreditCard, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

export default async function FinanceiroPage() {
  const supabase = await createClient();
  const { data: installments, error } = await supabase
    .from("inventory_purchase_installments")
    .select("id,installment_number,amount_cents,due_date,status,inventory_purchases(id,purchase_date,payment_method,installments,description,inventory_items(name,unit))")
    .order("due_date", { ascending: true })
    .limit(500);

  const rows = (installments ?? []) as unknown as {
    id: string; installment_number: number; amount_cents: number; due_date: string; status: string;
    inventory_purchases: {
      id: string; purchase_date: string; payment_method: string; installments: number; description: string | null;
      inventory_items: { name: string; unit: string } | null;
    } | null;
  }[];
  const today = new Date().toLocaleDateString("en-CA");
  const planned = rows.filter(row => row.status === "prevista");
  const paid = rows.filter(row => row.status === "paga");
  const overdue = planned.filter(row => row.due_date < today);
  return <main className="content">
    <div className="page-heading"><div><div className="eyebrow">Financeiro</div><h1>Fluxo de caixa</h1><p>Despesas de compras do estoque e parcelas previstas.</p></div></div>
    <section className="agenda-finance-summary">
      <article><span>Compras pagas</span><strong>{money(paid.reduce((sum,row)=>sum+Number(row.amount_cents),0))}</strong></article>
      <article><span>Parcelas previstas</span><strong>{money(planned.reduce((sum,row)=>sum+Number(row.amount_cents),0))}</strong></article>
      <article><span>Parcelas vencidas</span><strong>{money(overdue.reduce((sum,row)=>sum+Number(row.amount_cents),0))}</strong></article>
    </section>
    <section className="operation-panel">
      <div className="operation-title"><div><h2><CalendarClock size={17}/> Lançamentos de compras</h2><p>Cada parcela de cartão aparece separadamente na data prevista.</p></div></div>
      {error ? <p className="operation-empty">Não foi possível carregar o fluxo de caixa. Verifique a migration de compras de estoque.</p> : !rows.length ? <p className="operation-empty">Nenhuma compra registrada.</p> : <div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Vencimento</th><th>Produto</th><th>Forma de pagamento</th><th>Parcela</th><th>Valor</th><th>Situação</th><th>Descrição</th></tr></thead><tbody>{rows.map(row => {
        const purchase = row.inventory_purchases;
        return <tr key={row.id}><td>{date(row.due_date)}</td><td>{purchase?.inventory_items?.name ?? "Item removido"}</td><td>{purchase?.payment_method ?? "—"}</td><td>{row.installment_number}/{purchase?.installments ?? 1}</td><td><strong>{money(Number(row.amount_cents))}</strong></td><td><span className={`status-pill ${row.status === "paga" ? "status-pago" : row.due_date < today ? "status-cancelado" : "status-a-pagar"}`}>{row.status === "paga" ? "Paga" : row.due_date < today ? "Vencida" : "Prevista"}</span></td><td>{purchase?.description || "Compra de estoque"}</td></tr>;
      })}</tbody></table></div>}
    </section>
    <p className="operation-hint">Neste momento, a tela consolida despesas originadas por compras de estoque. Receitas de eventos continuam disponíveis na Agenda; a consolidação geral de receitas e despesas será uma etapa separada.</p>
  </main>;
}
