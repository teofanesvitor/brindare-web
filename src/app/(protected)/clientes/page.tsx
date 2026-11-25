import { headers } from "next/headers";
import { Bell, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { IntakeLinkActions } from "./intake-link-actions";
import { IntakeNotification } from "./intake-notification";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: intakes, error } = await supabase.from("client_intakes")
    .select("id,status,payload,created_at,submitted_at,expires_at")
    .order("created_at", { ascending: false }).limit(50);
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || (process.env.NODE_ENV === "development" ? "http" : "https");
  const configuredBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base = (configuredBase || (host ? `${protocol}://${host}` : "")).replace(/\/+$/, "");
  const permanentLink = base ? base + "/cadastro-cliente" : "/cadastro-cliente";

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
      {error ? <p className="operation-empty">Não foi possível carregar as solicitações. Verifique a conexão com o banco de dados.</p> : !intakes?.length ? <p className="operation-empty">Nenhuma solicitação recebida ainda.</p> : <div className="intake-list">{intakes.map(i => {
        const p = (i.payload || {}) as Record<string, string>;
        return <IntakeNotification
          key={i.id}
          intakeId={i.id}
          status={i.status}
          name={p.full_name || (i.status === "converted" && !i.payload ? "Dados enviados excluídos" : "Aguardando preenchimento")}
          email={i.payload ? (p.email || "Sem e-mail") : "Dados pessoais removidos"}
          phone={i.payload ? (p.phone || "Sem telefone") : ""}
          receivedAt={new Date(i.submitted_at || i.created_at).toLocaleDateString("pt-BR")}
        />;
      })}</div>}
    </section>
  </main>;
}
