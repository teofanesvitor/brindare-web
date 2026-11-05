import Link from "next/link";
import { Bell, Link2, UserRoundPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createClientIntakeLink } from "@/actions/operations";
import { IntakeLinkActions } from "./intake-link-actions";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link } = await searchParams;
  const supabase = await createClient();
  const { data: intakes, error } = await supabase.from("client_intakes")
    .select("id,status,payload,created_at,submitted_at,expires_at")
    .order("created_at", { ascending: false }).limit(50);
  const pending = (intakes ?? []).filter(i => i.status === "submitted");
  return <main className="content">
    <div className="page-heading"><div><div className="eyebrow">Relacionamento</div><h1>Clientes</h1><p>Envie um link para o cliente preencher os dados iniciais. A equipe revisa e finaliza o cadastro.</p></div></div>
    <section className="operation-panel">
      <div className="operation-title"><div><h2><Link2 size={17}/> Link de pré-cadastro</h2><p>O link é individual, expira em 14 dias e pode ser utilizado uma única vez.</p></div></div>
      <form action={createClientIntakeLink}><button className="operation-submit" type="submit"><UserRoundPlus size={16}/> Gerar link para cliente</button></form>
      {link && <div className="intake-link-box"><strong>Link criado</strong><p>Envie este endereço ao cliente por WhatsApp ou e-mail:</p><a href={link}>{link}</a><IntakeLinkActions link={link}/><p className="operation-hint">O link contém um token privado. Não publique em locais abertos.</p></div>}
    </section>
    <section className="operation-panel">
      <div className="operation-title"><div><h2><Bell size={17}/> Solicitações recebidas</h2><p>{pending.length} cadastro(s) aguardando revisão administrativa.</p></div></div>
      {error ? <p className="operation-empty">Não foi possível carregar as solicitações. Verifique se a migration foi aplicada.</p> : !intakes?.length ? <p className="operation-empty">Nenhum link foi criado ainda.</p> : <div className="intake-list">{intakes.map(i=>{const p=(i.payload || {}) as Record<string,string>;return <article className="intake-row" key={i.id}><div><strong>{p.full_name || "Aguardando preenchimento"}</strong><span>{p.email || "Sem e-mail"} · {p.phone || "Sem telefone"}</span><small>Criado em {new Date(i.created_at).toLocaleDateString("pt-BR")} {i.submitted_at ? `· Enviado em ${new Date(i.submitted_at).toLocaleDateString("pt-BR")}` : ""}</small></div><div className="intake-actions"><span className={`status-pill status-${i.status}`}>{i.status === "submitted" ? "Recebido" : i.status === "converted" ? "Convertido" : i.status === "expired" ? "Expirado" : "Aguardando"}</span>{i.status === "submitted" && <Link className="operation-link" href={`/clientes/${i.id}`}>Revisar cadastro</Link>}</div></article>})}</div>}
    </section>
  </main>;
}
