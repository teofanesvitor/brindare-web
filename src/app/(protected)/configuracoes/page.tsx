import { changeAccountPassword } from "@/actions/settings";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Activity, CalendarDays, FileText, Package, ShieldCheck, Users, Wallet } from "lucide-react";

type SearchParams = Promise<{ success?: string; error?: string }>;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ user, profile }, params] = await Promise.all([requireAdmin(), searchParams]);
  const db = await createClient();

  const checks = await Promise.all([
    db.from("events").select("id", { count: "exact", head: true }),
    db.from("contracts").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("inventory_items").select("id", { count: "exact", head: true }),
    db.from("client_intakes").select("id", { count: "exact", head: true }),
  ]);
  const labels = ["Eventos cadastrados", "Contratos registrados", "Usuários", "Itens de estoque", "Cadastros recebidos"];
  const icons = [CalendarDays, FileText, Users, Package, Activity];
  const hasErrors = checks.some((result) => result.error);
  const errorMessages: Record<string, string> = {
    short_password: "A nova senha precisa ter pelo menos 10 caracteres.",
    password_mismatch: "A confirmação não corresponde à nova senha.",
    password_update_failed: "Não foi possível atualizar a senha. Tente novamente.",
  };

  return <main className="content">
    <div className="page-heading"><div><h1>Configurações</h1><p className="page-description">Preferências da conta e informações operacionais.</p></div></div>

    {params.success === "password_updated" && <p className="operation-success" role="status">Senha atualizada com sucesso.</p>}
    {params.error && <p className="operation-empty" role="alert">{errorMessages[params.error] || "Não foi possível concluir a operação."}</p>}

    <section className="section-grid">
      <article className="panel">
        <div className="dashboard-panel-heading"><h3>Conta e acesso</h3><ShieldCheck size={19} color="#b18c19"/></div>
        <div className="settings-account">
          <div><span className="stat-label">Nome de exibição</span><strong>{profile.full_name || "Administrador"}</strong></div>
          <div><span className="stat-label">E-mail de acesso</span><strong>{user.email || "—"}</strong></div>
          <div><span className="stat-label">Nível de acesso</span><strong>Administrador</strong></div>
        </div>
        <p className="stat-note">O acesso administrativo permite consultar e gerenciar os dados operacionais da Brindare.</p>
      </article>

      <article className="panel">
        <div className="dashboard-panel-heading"><h3>Segurança</h3><ShieldCheck size={19} color="#b18c19"/></div>
        <p className="stat-note" style={{marginBottom:16}}>Altere sua senha de acesso. Recomendamos uma senha exclusiva com pelo menos 10 caracteres.</p>
        <form action={changeAccountPassword} className="settings-form">
          <label>Nova senha<input type="password" name="password" minLength={10} autoComplete="new-password" required /></label>
          <label>Confirmar nova senha<input type="password" name="confirmation" minLength={10} autoComplete="new-password" required /></label>
          <button type="submit" className="btn-primary">Atualizar senha</button>
        </form>
      </article>
    </section>

    <section className="panel settings-diagnostics">
      <div className="dashboard-panel-heading"><div><h3>Visão do sistema</h3><p className="stat-note">Resumo dos registros disponíveis no banco de dados.</p></div><span className={hasErrors ? "settings-status settings-status-warning" : "settings-status"}>{hasErrors ? "Verificar conexão" : "Conectado"}</span></div>
      <div className="stats-grid settings-stats">{checks.map((result, index) => {
        const Icon = icons[index];
        return <article className="stat-card" key={labels[index]}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span className="stat-label">{labels[index]}</span><Icon size={17} color="#b18c19"/></div><div className="stat-value">{result.error ? "—" : (result.count ?? 0).toLocaleString("pt-BR")}</div></article>;
      })}</div>
      {hasErrors && <p className="operation-empty">Um ou mais indicadores não puderam ser consultados. Verifique as permissões e a conexão com o Supabase.</p>}
    </section>

    <section className="panel">
      <div className="dashboard-panel-heading"><h3>Preferências operacionais</h3></div>
      <div className="settings-account">
        <div><span className="stat-label">Fuso horário</span><strong>Horário de Brasília (America/Maceio)</strong></div>
        <div><span className="stat-label">Moeda</span><strong>Real brasileiro (BRL)</strong></div>
        <div><span className="stat-label">Ambiente</span><strong>Brindare Web · Produção</strong></div>
      </div>
      <p className="stat-note">Datas, horários e valores seguem o padrão utilizado nas operações da empresa.</p>
    </section>
  </main>;
}
