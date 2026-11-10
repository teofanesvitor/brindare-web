import { CalendarClock, ChartNoAxesCombined, CircleDollarSign, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  createFinancialExpense,
  markFinancialExpensePaid,
  markInventoryInstallmentPaid,
  updateFinancialOpeningBalance,
} from "@/actions/operations";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const monthKey = (value: string) => value.slice(0, 7);
const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
};
const addMonths = (key: string, amount: number) => {
  const [year, month] = key.split("-").map(Number);
  const value = new Date(year, month - 1 + amount, 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
};
type SearchParams = Promise<{ installment?: string; expense?: string; settings?: string }>;

export default async function FinanceiroPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [
    monthlyResult, settingsResult, receivablesResult, payablesResult, expensesResult,
    installmentsResult, paymentsResult,
  ] = await Promise.all([
    supabase.from("financial_cashflow_monthly").select("month_start,revenue_cents,paid_expenses_cents,planned_expenses_cents").order("month_start", { ascending: true }),
    supabase.from("financial_settings").select("opening_balance_cents,opening_balance_date").eq("id", true).maybeSingle(),
    supabase.from("financial_receivables_summary").select("open_events,receivable_cents").maybeSingle(),
    supabase.from("financial_payables_summary").select("pending_cents,overdue_cents").maybeSingle(),
    supabase.from("financial_expenses").select("id,description,category,amount_cents,due_date,status,paid_at,payment_method").order("due_date", { ascending: false }).limit(60),
    supabase.from("inventory_purchase_installments").select("id,installment_number,amount_cents,due_date,status,paid_at,inventory_purchases(description,installments,inventory_items(name))").order("due_date", { ascending: false }).limit(60),
    supabase.from("event_payments").select("id,amount_cents,paid_at,payment_method,notes,events(client_name)").order("paid_at", { ascending: false }).limit(60),
  ]);

  const monthlyRows = (monthlyResult.data ?? []) as {
    month_start: string; revenue_cents: number; paid_expenses_cents: number; planned_expenses_cents: number;
  }[];
  const settings = settingsResult.data as { opening_balance_cents: number; opening_balance_date: string } | null;
  const openingBalance = Number(settings?.opening_balance_cents ?? 0);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Maceio" });
  const currentMonth = today.slice(0, 7);
  const openingMonth = settings?.opening_balance_date?.slice(0, 7) ?? currentMonth;
  const receivables = receivablesResult.data as { open_events: number; receivable_cents: number } | null;

  const monthlyMap = new Map(monthlyRows.map(row => [monthKey(row.month_start), row]));
  const firstMonth = monthlyRows.length ? monthKey(monthlyRows[0].month_start) : openingMonth;
  const lastDataMonth = monthlyRows.length ? monthKey(monthlyRows[monthlyRows.length - 1].month_start) : currentMonth;
  const startMonth = firstMonth < openingMonth ? firstMonth : openingMonth;
  const defaultEndMonth = addMonths(currentMonth, 12);
  const endMonth = lastDataMonth > defaultEndMonth ? lastDataMonth : defaultEndMonth;
  const months: { key: string; revenue: number; paidExpenses: number; plannedExpenses: number; net: number; balance: number | null }[] = [];
  let runningBalance = openingBalance;
  for (let key = startMonth; key <= endMonth; key = addMonths(key, 1)) {
    const row = monthlyMap.get(key);
    const revenue = Number(row?.revenue_cents ?? 0);
    const paidExpenses = Number(row?.paid_expenses_cents ?? 0);
    const plannedExpenses = Number(row?.planned_expenses_cents ?? 0);
    const net = revenue - paidExpenses;
    if (key >= openingMonth) runningBalance += net;
    months.push({ key, revenue, paidExpenses, plannedExpenses, net, balance: key >= openingMonth ? runningBalance : null });
  }
  const trackedMonths = months.filter(row => row.key >= openingMonth && row.key <= currentMonth);
  const totalRevenue = trackedMonths.reduce((sum, row) => sum + row.revenue, 0);
  const totalPaidExpenses = trackedMonths.reduce((sum, row) => sum + row.paidExpenses, 0);
  const operatingResult = totalRevenue - totalPaidExpenses;
  const cashBalance = openingBalance + operatingResult;
  const current = months.find(row => row.key === currentMonth) ?? { revenue: 0, paidExpenses: 0, plannedExpenses: 0, net: 0 };
  const plannedTotal = Number((payablesResult.data as { pending_cents: number; overdue_cents: number } | null)?.pending_cents ?? 0);
  const overdueTotal = Number((payablesResult.data as { pending_cents: number; overdue_cents: number } | null)?.overdue_cents ?? 0);
  const chartRows = months.filter(row => row.key <= currentMonth).slice(-12);
  const chartMax = Math.max(1, ...chartRows.flatMap(row => [row.revenue, row.paidExpenses]));
  const recent = [
    ...(paymentsResult.data ?? []).map((row: any) => ({
      id: row.id, date: row.paid_at, kind: "Receita", detail: row.events?.client_name ?? "Pagamento de evento",
      category: row.payment_method ?? "Evento", amount: Number(row.amount_cents), status: "Recebido",
    })),
    ...(installmentsResult.data ?? []).map((row: any) => ({
      id: row.id, date: row.paid_at ?? row.due_date, kind: "Despesa", detail: row.inventory_purchases?.inventory_items?.name ?? "Compra de estoque",
      category: `Estoque · ${row.installment_number}/${row.inventory_purchases?.installments ?? 1}`,
      amount: Number(row.amount_cents), status: row.status === "paga" ? "Pago" : "Previsto",
    })),
    ...(expensesResult.data ?? []).map((row: any) => ({
      id: row.id, date: row.paid_at ?? row.due_date, kind: "Despesa", detail: row.description,
      category: row.category, amount: Number(row.amount_cents), status: row.status === "paga" ? "Pago" : "Previsto",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  const dataError = monthlyResult.error || settingsResult.error || receivablesResult.error || payablesResult.error;
  const expenseError = expensesResult.error;
  return <main className="content">
    <div className="page-heading"><div><div className="eyebrow">Gestão financeira</div><h1>Fluxo de caixa</h1><p>Visão histórica, posição acumulada e compromissos financeiros da Brindare.</p></div></div>
    {params.installment === "paid" && <p className="operation-success">Parcela marcada como paga.</p>}
    {params.expense === "registered" && <p className="operation-success">Despesa registrada.</p>}
    {params.expense === "paid" && <p className="operation-success">Despesa marcada como paga.</p>}
    {params.settings === "saved" && <p className="operation-success">Saldo inicial atualizado.</p>}
    {dataError && <p className="error">Não foi possível carregar a consolidação financeira. Verifique se a migration 202611110001_financial_cashflow_management.sql foi aplicada no Supabase. Detalhe: {dataError.message}</p>}

    <section className="cashflow-kpis">
      <article><span>Saldo de caixa estimado</span><strong>{money(cashBalance)}</strong><small>Saldo inicial + movimentações desde {monthLabel(openingMonth)}</small></article>
      <article><span>Resultado operacional acumulado</span><strong>{money(operatingResult)}</strong><small>Recebimentos menos despesas pagas</small></article>
      <article><span>Total recebido no período</span><strong>{money(totalRevenue)}</strong><small>Pagamentos efetivamente registrados</small></article>
      <article><span>Total desembolsado</span><strong>{money(totalPaidExpenses)}</strong><small>Despesas efetivamente pagas</small></article>
      <article><span>Contas a receber</span><strong>{money(Number(receivables?.receivable_cents ?? 0))}</strong><small>{Number(receivables?.open_events ?? 0)} eventos com saldo aberto</small></article>
      <article><span>Contas a pagar</span><strong>{money(plannedTotal)}</strong><small>Parcelas e despesas ainda previstas</small></article>
    </section>

    <section className="operation-panel">
      <div className="operation-title"><div><h2><ChartNoAxesCombined size={17}/> Evolução mensal</h2><p>Histórico preservado por competência, com resultado e saldo acumulado.</p></div></div>
      <div className="cashflow-chart-legend"><span><i className="cashflow-dot revenue"/> Receitas</span><span><i className="cashflow-dot expense"/> Despesas pagas</span></div>
      {!chartRows.length ? <p className="operation-empty">Ainda não existem movimentações para montar o gráfico.</p> : <div className="cashflow-chart">{chartRows.map(row => <div className="cashflow-chart-month" key={row.key}>
        <div className="cashflow-bars"><div className="cashflow-bar revenue" style={{ height: `${Math.max(row.revenue ? 3 : 0, row.revenue / chartMax * 100)}%` }} title={`Receitas: ${money(row.revenue)}`}/><div className="cashflow-bar expense" style={{ height: `${Math.max(row.paidExpenses ? 3 : 0, row.paidExpenses / chartMax * 100)}%` }} title={`Despesas: ${money(row.paidExpenses)}`}/></div>
        <small>{monthLabel(row.key).slice(0, 3)}/{row.key.slice(2, 4)}</small>
      </div>)}</div>}
      <div className="operation-table-wrap"><table className="operation-table cashflow-history-table"><thead><tr><th>Mês</th><th>Receitas recebidas</th><th>Despesas pagas</th><th>Resultado do mês</th><th>Despesas previstas</th><th>Saldo acumulado</th></tr></thead><tbody>
        {months.filter(row => row.key <= currentMonth).slice().reverse().map(row => <tr key={row.key}><td><strong>{monthLabel(row.key)}</strong></td><td>{money(row.revenue)}</td><td>{money(row.paidExpenses)}</td><td><strong className={row.net >= 0 ? "cashflow-positive" : "cashflow-negative"}>{money(row.net)}</strong></td><td>{money(row.plannedExpenses)}</td><td>{row.balance === null ? "Anterior ao saldo inicial" : <strong>{money(row.balance)}</strong>}</td></tr>)}
      </tbody></table></div>
    </section>

    <section className="operation-panel">
      <div className="operation-title"><div><h2><CalendarClock size={17}/> Planejamento e reserva mensal</h2><p>Quanto reservar em cada mês para compromissos ainda não pagos.</p></div></div>
      <div className="agenda-finance-summary">
        <article><span>Receitas deste mês</span><strong>{money(current.revenue)}</strong></article>
        <article><span>Despesas pagas neste mês</span><strong>{money(current.paidExpenses)}</strong></article>
        <article><span>Reserva pendente deste mês</span><strong>{money(current.plannedExpenses)}</strong></article>
      </div>
      <div className="agenda-finance-summary">
        <article><span>Contas vencidas</span><strong>{money(overdueTotal)}</strong></article>
        <article><span>Compromissos futuros</span><strong>{money(plannedTotal)}</strong></article>
        <article><span>Saldo de contas a receber</span><strong>{money(Number(receivables?.receivable_cents ?? 0))}</strong></article>
      </div>
      <div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Competência</th><th>Receitas</th><th>Despesas pagas</th><th>Despesas a reservar</th><th>Resultado realizado</th></tr></thead><tbody>
        {months.filter(row => row.key >= currentMonth && row.plannedExpenses + row.revenue + row.paidExpenses > 0).map(row => <tr key={row.key}><td><strong>{monthLabel(row.key)}</strong></td><td>{money(row.revenue)}</td><td>{money(row.paidExpenses)}</td><td><strong>{money(row.plannedExpenses)}</strong></td><td>{money(row.net)}</td></tr>)}
      </tbody></table></div>
    </section>

    <section className="operation-columns cashflow-entry-columns">
      <section className="operation-panel">
        <div className="operation-title"><div><h2><CircleDollarSign size={17}/> Registrar despesa</h2><p>Cadastre despesas operacionais fora das compras de estoque.</p></div></div>
        <form action={createFinancialExpense} className="operation-form">
          <label className="full-width">Descrição<input name="description" placeholder="Ex.: combustível para evento" required minLength={2}/></label>
          <label>Categoria<select name="category" required><option value="">Selecione</option>{["Transporte","Combustível","Manutenção","Mão de obra","Serviços terceirizados","Materiais","Administrativo","Impostos e taxas","Outros"].map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required/></label>
          <label>Data de vencimento<input name="due_date" type="date" required defaultValue={today}/></label>
          <label>Situação inicial<select name="status" defaultValue="prevista"><option value="prevista">A pagar</option><option value="paga">Já paga</option></select></label>
          <label>Data do pagamento (se paga)<input name="paid_at" type="date" defaultValue={today}/></label>
          <label>Forma de pagamento<input name="payment_method" placeholder="Pix, dinheiro, cartão..."/></label>
          <button className="operation-submit full-width" type="submit">Salvar despesa</button>
        </form>
      </section>
      <section className="operation-panel">
        <div className="operation-title"><div><h2><Wallet size={17}/> Saldo inicial do caixa</h2><p>Informe o dinheiro disponível no início do período de controle.</p></div></div>
        <form action={updateFinancialOpeningBalance} className="operation-form">
          <label>Saldo inicial (R$)<input name="opening_balance" type="number" min="0" step="0.01" required defaultValue={(openingBalance / 100).toFixed(2)}/></label>
          <label>Mês de início do controle<input name="opening_balance_date" type="month" required defaultValue={openingMonth}/></label>
          <button className="operation-submit full-width" type="submit">Atualizar saldo inicial</button>
        </form>
        <p className="operation-hint">O saldo acumulado considera o saldo inicial informado mais receitas e despesas efetivamente pagas a partir do primeiro dia do mês selecionado. Use o mês em que começa a conciliação do caixa para evitar duplicidade.</p>
      </section>
    </section>

    <section className="operation-panel">
      <div className="operation-title"><div><h2>Despesas operacionais pendentes</h2><p>Contas cadastradas fora das compras de estoque.</p></div></div>
      {expenseError ? <p className="operation-empty">Não foi possível carregar as despesas. Aplique a migration financeira.</p> : !(expensesResult.data ?? []).filter((row: any) => row.status === "prevista").length ? <p className="operation-empty">Nenhuma despesa operacional pendente.</p> : <div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Situação</th><th>Ação</th></tr></thead><tbody>
        {(expensesResult.data ?? []).filter((row: any) => row.status === "prevista").map((row: any) => <tr key={row.id}><td>{date(row.due_date)}</td><td>{row.description}</td><td>{row.category}</td><td><strong>{money(Number(row.amount_cents))}</strong></td><td><span className={`status-pill ${row.due_date < today ? "status-cancelado" : "status-a-pagar"}`}>{row.due_date < today ? "Vencida" : "A pagar"}</span></td><td><form action={markFinancialExpensePaid} className="cashflow-pay-form"><input type="hidden" name="expense_id" value={row.id}/><input name="paid_at" type="date" defaultValue={today} aria-label="Data de pagamento"/><button className="operation-link" type="submit">Marcar paga</button></form></td></tr>)}
      </tbody></table></div>}
    </section>

    <section className="operation-panel">
      <div className="operation-title"><div><h2>Parcelas de estoque pendentes</h2><p>Compras parceladas que ainda precisam ser quitadas.</p></div></div>
      {!(installmentsResult.data ?? []).filter((row: any) => row.status === "prevista").length ? <p className="operation-empty">Nenhuma parcela de estoque pendente.</p> : <div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Competência</th><th>Produto</th><th>Parcela</th><th>Valor</th><th>Situação</th><th>Ação</th></tr></thead><tbody>
        {(installmentsResult.data ?? []).filter((row: any) => row.status === "prevista").map((row: any) => <tr key={row.id}><td>{monthLabel(monthKey(row.due_date))}</td><td>{row.inventory_purchases?.inventory_items?.name ?? "Compra de estoque"}</td><td>{row.installment_number}/{row.inventory_purchases?.installments ?? 1}</td><td><strong>{money(Number(row.amount_cents))}</strong></td><td><span className="status-pill status-a-pagar">{row.due_date < today ? "Vencida" : "A reservar"}</span></td><td><form action={markInventoryInstallmentPaid}><input type="hidden" name="installment_id" value={row.id}/><button className="operation-link" type="submit">Marcar como paga</button></form></td></tr>)}
      </tbody></table></div>}
    </section>
    <section className="operation-panel">
      <div className="operation-title"><div><h2>Histórico recente de movimentações</h2><p>Últimos recebimentos e lançamentos de despesas. O histórico mensal acima é integral e não depende deste limite de exibição.</p></div></div>
      {!recent.length ? <p className="operation-empty">Nenhuma movimentação registrada.</p> : <div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria / referência</th><th>Valor</th><th>Situação</th></tr></thead><tbody>
        {recent.map(row => <tr key={`${row.kind}-${row.id}`}><td>{date(row.date)}</td><td>{row.kind}</td><td>{row.detail}</td><td>{row.category}</td><td><strong>{money(row.amount)}</strong></td><td>{row.status}</td></tr>)}
      </tbody></table></div>}
    </section>
    <p className="operation-hint">Receitas são contabilizadas pela data do recebimento. Despesas pagas entram no caixa pela data efetiva do pagamento; compromissos pendentes permanecem no planejamento até a quitação. O saldo de caixa é uma estimativa gerencial e deve ser conciliado com bancos e dinheiro físico.</p>
  </main>;
}
