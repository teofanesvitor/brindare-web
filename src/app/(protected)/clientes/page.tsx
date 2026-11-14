import Link from "next/link";
import { Bell, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { IntakeLinkActions } from "./intake-link-actions";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: intakes, error } = await supabase.from("client_intakes")
    .select("id,status,payload,created_at,submitted_at,expires_at")
    .order("created_at", { ascending: false }).limit(50);
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\\/$/, "");
  const permanentLink = base + "/cadastro-cliente";

  return <main className="content">
    <div className="page-heading"><div><h1>Clientes</h1></div></div>
    <section className="operation-panel">
      <div className="operation-title"><div><h2><Link2 size={17}/> Link permanente de pré-cadastro</h2><p>O mesmo endereço pode ser enviado a todos os clientes. Cada envio gera uma nova solicitação para revisão.</p></div></div>
      <div className="intake-link-box">
        <strong>Endereço público de cadastro</strong>
        <a href={permanentLink}>{permanentLink}</a>
        <IntakeLinkActions link={permanentLink}/>
        <p className="operation-hint">Este link não expira e pode ser compartilhado publicamente. Não contém dados de clientes.</p>
      </div>
    </section>
    <section className="operation-panel">
      <div className="operation-title"><div><h2><Bell size={17}/> Solicitações recebidas</h2></div></div>
      {error ? <p className="operation-empty">Não foi possível carregar as solicitações. Verifique a conexão com o banco de dados.</p> : !intakes?.length ? <p className="operation-empty">Nenhuma solicitação recebida ainda.</p> : <div className="intake-list">{intakes.map(i=>{const p=(i.payload || {}) as Record<string,string>;return <article className="intake-row" key={i.id}><div><strong>{p.full_name || "Aguardando preenchimento"}</strong><span>{p.email || "Sem e-mail"} · {p.phone || "Sem telefone"}</span><small>Recebido em {new Date(i.submitted_at || i.created_at).toLocaleDateString("pt-BR")}</small></div><div className="intake-actions"><span className={`status-pill status-${i.status}`}>{i.status === "submitted" ? "Recebido" : i.status === "converted" ? "Convertido" : i.status === "expired" ? "Expirado" : "Aguardando"}</span>{i.status === "submitted" && <Link className="operation-link" href={`/clientes/${i.id}`}>Revisar cadastro</Link>}</div></article>})}</div>}
    </section>
  </main>;
}
