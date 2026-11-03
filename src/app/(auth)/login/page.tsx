import { signIn } from "@/actions/auth";

const messages: Record<string, string> = {
  invalid_input: "Informe um e-mail válido e sua senha.",
  invalid_credentials: "E-mail ou senha incorretos.",
  access_denied: "Esta conta não possui permissão administrativa. Procure o administrador do sistema.",
};
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="auth-shell">
    <section className="auth-brand">
      <div><div className="brand-kicker">Experiências que ficam</div><div className="brand-word">brindare<span style={{ color: "#fff", fontSize: ".7em" }}>.</span></div></div>
      <div className="brand-copy">Cada detalhe importa. Organize os bastidores para celebrar os grandes momentos.</div>
      <div className="brand-foot">BRINDARE · GESTÃO DE EVENTOS</div>
    </section>
    <section className="auth-panel"><div className="auth-card">
      <div className="eyebrow">Área administrativa</div><h1>Acesse sua conta</h1><p className="muted" style={{ fontSize: 13 }}>Entre com seu e-mail corporativo para continuar.</p>
      {error && messages[error] && <div className="error" role="alert">{messages[error]}</div>}
      <form action={signIn}>
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="username" required placeholder="nome@empresa.com" /></div>
        <div className="field"><label htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Sua senha" /></div>
        <button className="primary-btn" type="submit">Entrar no sistema</button>
      </form>
      <p className="muted" style={{ fontSize: 11, marginTop: 22 }}>Acesso restrito a usuários autorizados.</p>
    </div></section>
  </main>;
}
