import { CalendarDays, CircleDollarSign, PackageCheck, Users } from "lucide-react";
const stats = [
  { label: "Eventos no mês", value: "—", note: "Será conectado aos agendamentos", icon: CalendarDays },
  { label: "Recebido no mês", value: "R$ —", note: "Pagamentos confirmados", icon: CircleDollarSign },
  { label: "A receber", value: "R$ —", note: "Saldo dos contratos", icon: Users },
  { label: "Estoque crítico", value: "—", note: "Produtos abaixo do mínimo", icon: PackageCheck },
];
export default function DashboardPage() {
  return <main className="content">
    <div className="page-heading"><div><div className="eyebrow">Painel de controle</div><h1>Visão geral</h1><p>Acompanhe a operação da Brindare em um só lugar.</p></div></div>
    <section className="welcome-card"><div><div className="brand-kicker" style={{ fontSize: 10 }}>Bem-vindo ao Brindare Web</div><h2>Os bastidores de cada celebração.</h2><p>Centralize clientes, eventos, contratos, financeiro e estoque com uma operação mais simples e organizada.</p></div><div className="welcome-mark">b.</div></section>
    <section className="stats-grid" aria-label="Indicadores"><>{stats.map(({ label, value, note, icon: Icon }) => <article className="stat-card" key={label}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="stat-label">{label}</span><Icon size={18} color="#b18c19"/></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>)}</></section>
    <section className="section-grid"><article className="panel"><h3>Próximos eventos</h3><div className="panel-sub">A agenda será exibida aqui após a Fase 2.</div><div className="empty-state"><div className="empty-icon"><CalendarDays size={20}/></div>Nenhum evento carregado nesta etapa.</div></article><article className="panel"><h3>Atividade recente</h3><div className="panel-sub">Acompanhe as últimas movimentações.</div><div className="empty-state"><div className="empty-icon"><Users size={20}/></div>As atividades aparecerão aqui.</div></article></section>
    <div className="footer-note">Brindare Web · Fundação do sistema · Os indicadores serão habilitados nas próximas fases.</div>
  </main>;
}
