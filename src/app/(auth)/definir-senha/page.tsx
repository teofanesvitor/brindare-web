import { updatePassword } from "@/actions/auth";

const messages: Record<string, string> = {
  short_password: "A senha deve ter pelo menos 8 caracteres.",
  password_mismatch: "As senhas não coincidem.",
  update_failed: "Não foi possível salvar a senha. Tente novamente.",
};

export default async function DefinePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div>
          <div className="brand-kicker">Experiências que ficam</div>
          <div className="brand-word">
            brindare<span style={{ color: "#fff", fontSize: ".7em" }}>.</span>
          </div>
        </div>
        <div className="brand-copy">
          Cada detalhe importa. Organize os bastidores para celebrar os grandes momentos.
        </div>
        <div className="brand-foot">BRINDARE · GESTÃO DE EVENTOS</div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="eyebrow">Primeiro acesso</div>
          <h1>Defina sua senha</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Crie uma senha para acessar o sistema Brindare.
          </p>

          {error && messages[error] && (
            <div className="error" role="alert">
              {messages[error]}
            </div>
          )}

          <form action={updatePassword}>
            <div className="field">
              <label htmlFor="password">Nova senha</label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
                placeholder="Mínimo de 8 caracteres"
              />
            </div>

            <div className="field">
              <label htmlFor="confirmation">Confirme sua senha</label>
              <input
                id="confirmation"
                name="confirmation"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
                placeholder="Digite novamente"
              />
            </div>

            <button className="primary-btn" type="submit">
              Salvar senha e acessar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}