import { Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createInventoryItem, createInventoryMovement, createInventoryPurchase } from "@/actions/operations";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
type SearchParams = Promise<{ purchase?: string; movement?: string }>;

export default async function EstoquePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: items, error }, { data: movements }] = await Promise.all([
    supabase.from("inventory_items").select("id,name,unit,minimum_quantity,active,item_type").eq("active", true).order("name"),
    supabase.from("inventory_movements").select("id,item_id,movement_type,quantity,description,created_at,inventory_items(name,unit)").order("created_at", { ascending: false }).limit(100),
  ]);
  const stock = (items ?? []).map(item => {
    const rows = (movements ?? []).filter(m => m.item_id === item.id);
    const quantity = rows.reduce((sum, m) => sum + (m.movement_type === "entrada" ? Number(m.quantity) : m.movement_type === "saida" ? -Number(m.quantity) : Number(m.quantity)), 0);
    return { ...item, quantity, critical: Number(item.minimum_quantity) > 0 && quantity <= Number(item.minimum_quantity) };
  });
  const today = new Date().toLocaleDateString("en-CA");
  return <main className="content">
    <div className="page-heading"><div><div className="eyebrow">Operação</div><h1>Estoque</h1><p>Controle materiais reutilizáveis, consumíveis, compras e consumo.</p></div></div>

    {params.purchase === "registered" && <p className="operation-success">Compra registrada. A entrada foi adicionada ao estoque e as parcelas foram lançadas no fluxo de caixa.</p>}
    {params.movement === "registered" && <p className="operation-success">Saída registrada com sucesso.</p>}

    <div className="inventory-section-label">Materiais reutilizáveis</div>
    <div className="inventory-grid">{stock.filter(i => i.item_type === "reutilizavel").map(item=><article className="inventory-card" key={item.id}><div className="inventory-card-top"><span>{item.name}</span>{item.critical ? <AlertTriangle size={17} color="#b45b32"/> : <Package size={17} color="#a88618"/>}</div><strong>{item.quantity.toLocaleString("pt-BR")} <small>{item.unit}</small></strong><p>Mínimo: {Number(item.minimum_quantity).toLocaleString("pt-BR")} {item.unit}</p>{item.critical && <span className="inventory-warning">Estoque no mínimo ou abaixo</span>}</article>)}</div>
    <div className="inventory-section-label">Materiais consumíveis</div>
    <div className="inventory-grid">{stock.filter(i => i.item_type !== "reutilizavel").map(item=><article className="inventory-card" key={item.id}><div className="inventory-card-top"><span>{item.name}</span>{item.critical ? <AlertTriangle size={17} color="#b45b32"/> : <Package size={17} color="#a88618"/>}</div><strong>{item.quantity.toLocaleString("pt-BR")} <small>{item.unit}</small></strong><p>Mínimo: {Number(item.minimum_quantity).toLocaleString("pt-BR")} {item.unit}</p>{item.critical && <span className="inventory-warning">Estoque no mínimo ou abaixo</span>}</article>)}</div>

    <div className="operation-columns">
      <section className="operation-panel"><div className="operation-title"><div><h2><ShoppingCart size={17}/> Registrar compra</h2><p>A compra aumenta o estoque e cria as despesas no fluxo de caixa.</p></div></div>
        <form action={createInventoryPurchase} className="operation-form">
          <label>Item<select name="item_id" required defaultValue=""><option value="" disabled>Selecione</option>{(items??[]).map(i=><option value={i.id} key={i.id}>{i.name}</option>)}</select></label>
          <label>Quantidade<input name="quantity" type="number" min="0.01" step="0.01" required/></label>
          <label>Valor total da compra (R$)<input name="total" type="number" min="0.01" step="0.01" required/></label>
          <label>Data da compra<input name="purchase_date" type="date" defaultValue={today} required/></label>
          <label>Forma de pagamento<select name="payment_method" required defaultValue=""><option value="" disabled>Selecione</option><option>Dinheiro</option><option>Pix</option><option>Débito</option><option>Crédito</option></select></label>
          <label>Parcelas (somente crédito)<select name="installments" defaultValue="1">{Array.from({length:24},(_,i)=><option value={i+1} key={i+1}>{i+1}x</option>)}</select></label>
          <label className="operation-form-wide">Descrição<input name="description" placeholder="Fornecedor, nota fiscal ou observação"/></label>
          <button className="operation-submit" type="submit">Registrar compra</button>
        </form>
        <p className="operation-hint">Compras em dinheiro, Pix e débito entram como pagas na data informada. Compras no crédito geram parcelas mensais previstas a partir do mês seguinte à compra. O sistema usa o primeiro dia de cada mês como competência para planejamento, sem depender do vencimento real da fatura.</p>
      </section>

      <section className="operation-panel"><div className="operation-title"><div><h2><ArrowDownCircle size={17}/> Registrar saída</h2><p>Registre consumo em eventos, perdas ou baixas.</p></div></div>
        <form action={createInventoryMovement} className="operation-form">
          <input type="hidden" name="movement_type" value="saida"/>
          <label className="operation-form-wide">Item<select name="item_id" required defaultValue=""><option value="" disabled>Selecione</option>{(items??[]).map(i=><option value={i.id} key={i.id}>{i.name}</option>)}</select></label>
          <label>Quantidade<input name="quantity" type="number" min="0.01" step="0.01" required/></label>
          <label>Descrição<input name="description" placeholder="Evento, consumo, perda..."/></label>
          <button className="operation-submit" type="submit">Registrar saída</button>
        </form>
        <div className="inventory-divider"/>
        <div className="operation-title"><div><h2><Package size={17}/> Cadastrar item</h2><p>Defina se o material retorna ao estoque ou é consumido.</p></div></div>
        <form action={createInventoryItem} className="operation-form">
          <label>Produto<input name="name" required placeholder="Ex.: Suporte de mesa"/></label>
          <label>Tipo<select name="item_type" defaultValue="consumivel"><option value="reutilizavel">Reutilizável</option><option value="consumivel">Consumível</option></select></label>
          <label>Unidade<input name="unit" defaultValue="unidade" required/></label>
          <label>Estoque mínimo<input name="minimum_quantity" type="number" min="0" step="0.01" defaultValue="0"/></label>
          <button className="operation-submit" type="submit">Adicionar item</button>
        </form>
      </section>
    </div>

    <section className="operation-panel"><div className="operation-title"><div><h2><ArrowUpCircle size={17}/> Movimentações recentes</h2><p>Últimas entradas de compra e saídas de materiais.</p></div></div>
      {error ? <p className="operation-empty">Não foi possível carregar o estoque. Verifique a migration.</p> : !movements?.length ? <p className="operation-empty">Nenhuma movimentação registrada.</p> : <div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Descrição</th></tr></thead><tbody>{movements.slice(0,30).map(m=><tr key={m.id}><td>{new Date(m.created_at).toLocaleString("pt-BR")}</td><td>{(m.inventory_items as unknown as {name:string})?.name}</td><td>{m.movement_type === "entrada" ? "Compra / entrada" : m.movement_type === "saida" ? "Saída" : "Ajuste"}</td><td>{m.quantity}</td><td>{m.description || "—"}</td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
