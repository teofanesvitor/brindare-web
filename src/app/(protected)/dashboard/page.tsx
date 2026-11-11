import Link from "next/link";
import { Activity, CalendarDays, CircleDollarSign, PackageCheck, Users, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
const money = (n: number) => new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"}).format(n/100);
const date = (s: string) => new Date(`${s.slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR");

export default async function DashboardPage() {
  const db = await createClient();
  const now = new Date();
  const today = now.toLocaleDateString("en-CA");
  const start = new Date(now.getFullYear(),now.getMonth(),1).toLocaleDateString("en-CA");
  const end = new Date(now.getFullYear(),now.getMonth()+1,1).toLocaleDateString("en-CA");
  const [{data:events,error:eventError},{data:items,error:itemError},{data:movements,error:movementError}] = await Promise.all([
    db.from("events").select("id,client_name,event_date,event_time,venue,package_name,total_cents,status,created_at,event_payments(amount_cents,paid_at)").neq("status","Cancelado").order("event_date").limit(500),
    db.from("inventory_items").select("id,name,unit,minimum_quantity").eq("active",true),
    db.from("inventory_movements").select("id,item_id,movement_type,quantity,description,created_at").order("created_at",{ascending:false}).limit(1000),
  ]);
  const rows = events ?? [];
  const monthEvents = rows.filter(e=>e.event_date>=start && e.event_date<end);
  const received = rows.reduce((sum,e)=>sum+((e.event_payments ?? []) as {amount_cents:number;paid_at:string}[]).filter(p=>p.paid_at>=start && p.paid_at<end).reduce((s,p)=>s+Number(p.amount_cents),0),0);
  const receivable = rows.reduce((sum,e)=>sum+Math.max(0,Number(e.total_cents)-((e.event_payments ?? []) as {amount_cents:number}[]).reduce((s,p)=>s+Number(p.amount_cents),0)),0);
  const balances = new Map<string,number>();
  for(const m of movements ?? []) { const q=Number(m.quantity); balances.set(m.item_id,(balances.get(m.item_id)??0)+(m.movement_type==="entrada"?q:m.movement_type==="saida"?-q:q)); }
  const critical=(items??[]).filter(i=>Number(i.minimum_quantity)>0 && (balances.get(i.id)??0)<=Number(i.minimum_quantity));
  const upcoming=rows.filter(e=>e.event_date>=today && e.status!=="Realizado").slice(0,5);
  const activity=[
    ...rows.map(e=>({id:e.id,title:`Evento cadastrado: ${e.client_name}`,detail:`${date(e.event_date)} · ${e.package_name}`,at:e.created_at,kind:"event"})),
    ...(movements??[]).slice(0,10).map(m=>({id:m.id,title:m.movement_type==="entrada"?"Entrada no estoque":m.movement_type==="saida"?"Saída no estoque":"Ajuste de estoque",detail:m.description||"Movimentação de material",at:m.created_at,kind:"stock"})),
  ].sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0,6);
  const stats=[
    {label:"Eventos no mês",value:String(monthEvents.length),note:"Eventos agendados no mês atual",icon:CalendarDays},
    {label:"Recebido no mês",value:money(received),note:"Pagamentos recebidos neste mês",icon:CircleDollarSign},
    {label:"A receber",value:money(receivable),note:"Saldo de eventos não cancelados",icon:Users},
    {label:"Estoque crítico",value:String(critical.length),note:"Itens no mínimo ou abaixo",icon:PackageCheck},
  ];
  return <main className="content">
    <div className="page-heading"><div><h1>Visão geral</h1></div></div>
    <section className="welcome-card"><div><h2>Os bastidores de cada celebração.</h2></div><div className="welcome-mark">b.</div></section>
    <section className="stats-grid" aria-label="Indicadores">{stats.map(({label,value,note,icon:Icon})=><article className="stat-card" key={label}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span className="stat-label">{label}</span><Icon size={18} color="#b18c19"/></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>)}</section>
    {(eventError||itemError||movementError)&&<p className="operation-empty">Alguns dados não puderam ser carregados. Verifique as migrations e permissões do Supabase.</p>}
    <section className="section-grid">
      <article className="panel"><div className="dashboard-panel-heading"><div><h3>Próximos eventos</h3></div><Link href="/agenda" className="dashboard-source-link">Ver agenda <ArrowUpRight size={14}/></Link></div>{!upcoming.length?<div className="empty-state"><div className="empty-icon"><CalendarDays size={20}/></div>Nenhum evento futuro cadastrado.</div>:<div className="dashboard-list">{upcoming.map(e=><Link href="/agenda" className="dashboard-list-row dashboard-list-row-link" key={e.id}><div className="dashboard-list-icon"><CalendarDays size={17}/></div><div className="dashboard-list-content"><strong>{e.client_name}</strong><span>{date(e.event_date)}{e.event_time?` · ${e.event_time.slice(0,5)}`:""} · {e.venue}</span></div><span className="dashboard-list-status">{e.status}</span><ArrowUpRight size={15}/></Link>)}</div>}</article>
      <article className="panel"><h3>Atividade recente</h3>{!activity.length?<div className="empty-state"><div className="empty-icon"><Activity size={20}/></div>Nenhuma atividade registrada.</div>:<div className="dashboard-list">{activity.map(a=><div className="dashboard-list-row" key={a.kind+a.id}><div className="dashboard-list-icon">{a.kind==="event"?<CalendarDays size={17}/>:<PackageCheck size={17}/>}</div><div className="dashboard-list-content"><strong>{a.title}</strong><span>{a.detail}</span></div><small>{new Date(a.at).toLocaleDateString("pt-BR")}</small></div>)}</div>}</article>
    </section>
    {critical.length>0&&<section className="panel dashboard-critical"><div className="dashboard-panel-heading"><h3>Estoque que precisa de atenção</h3><Link href="/estoque" className="dashboard-source-link">Ver estoque <ArrowUpRight size={14}/></Link></div><div className="dashboard-list">{critical.map(i=><Link href="/estoque" className="dashboard-list-row dashboard-list-row-link" key={i.id}><div className="dashboard-list-icon"><PackageCheck size={17}/></div><div className="dashboard-list-content"><strong>{i.name}</strong><span>Saldo: {(balances.get(i.id)??0).toLocaleString("pt-BR")} {i.unit} · Mínimo: {Number(i.minimum_quantity).toLocaleString("pt-BR")} {i.unit}</span></div><ArrowUpRight size={15}/></Link>)}</div></section>}
    
  </main>;
}