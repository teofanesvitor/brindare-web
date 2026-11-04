import { Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createInventoryItem, createInventoryMovement } from "@/actions/operations";

export default async function EstoquePage() {
  const supabase = await createClient();
  const [{ data: items, error }, { data: movements }] = await Promise.all([
    supabase.from("inventory_items").select("id,name,unit,minimum_quantity,active").eq("active", true).order("name"),
    supabase.from("inventory_movements").select("id,item_id,movement_type,quantity,description,created_at,inventory_items(name,unit)").order("created_at", { ascending: false }),
  ]);
  const stock = (items ?? []).map(item => {
    const rows = (movements ?? []).filter(m => m.item_id === item.id);
    const quantity = rows.reduce((sum, m) => sum + (m.movement_type === "entrada" ? Number(m.quantity) : m.movement_type === "saida" ? -Number(m.quantity) : Number(m.quantity)), 0);
    return { ...item, quantity, critical: quantity <= Number(item.minimum_quantity) };
  });
  return <main className="content">
    <div className="page-heading"><div><div className="eyebrow">Operação</div><h1>Estoque</h1><p>Controle entradas, saídas e níveis mínimos dos materiais da Brindare.</p></div></div>
    <div className="inventory-grid">{stock.map(item=><article className="inventory-card" key={item.id}><div className="inventory-card-top"><span>{item.name}</span>{item.critical ? <AlertTriangle size={17} color="#b45b32"/> : <Package size={17} color="#a88618"/>}</div><strong>{item.quantity.toLocaleString("pt-BR")} <small>{item.unit}</small></strong><p>Mínimo: {Number(item.minimum_quantity).toLocaleString("pt-BR")} {item.unit}</p>{item.critical && <span className="inventory-warning">Estoque no mínimo ou abaixo</span>}</article>)}</div>
    <div className="operation-columns">
      <section className="operation-panel"><div className="operation-title"><div><h2><ArrowDownCircle size={17}/> Registrar movimentação</h2><p>Registre compras, reposições e consumo de materiais.</p></div></div>
        <form action={createInventoryMovement} className="operation-form">
          <label>Item<select name="item_id" required defaultValue=""><option value="" disabled>Selecione</option>{(items??[]).map(i=><option value={i.id} key={i.id}>{i.name}</option>)}</select></label>
          <label>Movimentação<select name="movement_type"><option value="entrada">Entrada</option><option value="saida">Saída / consumo</option></select></label>
          <label>Quantidade<input name="quantity" type="number" min="0.01" step="0.01" required/></label>
          <label>Descrição<input name="description" placeholder="Compra, evento, perda..."/></label>
          <button className="operation-submit" type="submit">Registrar</button>
        </form>
      </section>
      <section className="operation-panel"><div className="operation-title"><div><h2><Package size={17}/> Novo item</h2><p>Cadastre um material e seu limite mínimo.</p></div></div>
        <form action={createInventoryItem} className="operation-form">
          <label>Produto<input name="name" required placeholder="Ex.: Extensão"/></label>
          <label>Unidade<input name="unit" defaultValue="unidade" required/></label>
          <label>Estoque mínimo<input name="minimum_quantity" type="number" min="0" step="0.01" defaultValue="0"/></label>
          <button className="operation-submit" type="submit">Adicionar item</button>
        </form>
      </section>
    </div>
    <section className="operation-panel"><div className="operation-title"><div><h2><ArrowUpCircle size={17}/> Movimentações recentes</h2><p>Últimas 30 entradas e saídas.</p></div></div>
      {error ? <p className="operation-empty">Não foi possível carregar o estoque. Verifique a migration.</p> : !movements?.length ? <p className="operation-empty">Nenhuma movimentação registrada. Cadastre as quantidades atuais como entradas para iniciar o saldo.</p> : <div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Descrição</th></tr></thead><tbody>{movements.slice(0,30).map(m=><tr key={m.id}><td>{new Date(m.created_at).toLocaleString("pt-BR")}</td><td>{(m.inventory_items as unknown as {name:string})?.name}</td><td>{m.movement_type === "entrada" ? "Entrada" : m.movement_type === "saida" ? "Saída" : "Ajuste"}</td><td>{m.quantity}</td><td>{m.description || "—"}</td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
