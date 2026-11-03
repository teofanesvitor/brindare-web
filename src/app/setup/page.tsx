import { AlertCircle, CheckCircle2, ExternalLink, Terminal } from "lucide-react";

export default function SetupPage() {
  return (
    <main className="setup-shell">
      <section className="setup-card">
        <div className="setup-brand">brindare<span>.</span></div>
        <div className="eyebrow">Configuração inicial</div>
        <h1>Conecte o banco de dados</h1>
        <p className="setup-lead">
          O ambiente web está instalado, mas ainda não recebeu as credenciais do Supabase.
          Configure as duas variáveis abaixo para habilitar login e acesso ao sistema.
        </p>

        <div className="setup-alert"><AlertCircle size={19} /><div><strong>Supabase não configurado</strong><span>Este aviso substitui o erro técnico que aparecia durante a inicialização.</span></div></div>

        <h2>1. Crie ou abra seu projeto Supabase</h2>
        <p>Acesse o painel, crie um projeto para a Brindare e abra <strong>Project Settings → API</strong> (ou a área equivalente de API Keys).</p>
        <a className="setup-link" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Abrir Supabase Dashboard <ExternalLink size={15}/></a>

        <h2>2. Crie o arquivo .env.local</h2>
        <p>No VS Code, na pasta principal do projeto (a mesma de <code>package.json</code>), crie um arquivo chamado <code>.env.local</code> e insira:</p>
        <pre>{`NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA`}</pre>
        <p>Copie a URL do projeto e a chave pública <strong>anon</strong> ou <strong>publishable</strong>. Não use a chave <code>service_role</code> nesse arquivo com prefixo <code>NEXT_PUBLIC_</code>.</p>

        <h2>3. Reinicie o servidor</h2>
        <div className="setup-command"><Terminal size={17}/><code>npm.cmd run dev</code></div>
        <p>Se o terminal já estiver executando o servidor, pressione <code>Ctrl + C</code> antes de executar o comando novamente. Depois atualize <code>http://localhost:3000</code>.</p>

        <div className="setup-note"><CheckCircle2 size={17}/><span>O arquivo <code>.env.local</code> é local e não deve ser enviado ao GitHub. O projeto já está preparado para voltar automaticamente a esta tela se as credenciais estiverem ausentes ou incompletas.</span></div>
      </section>
    </main>
  );
}
