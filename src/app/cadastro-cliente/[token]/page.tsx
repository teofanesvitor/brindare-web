import { IntakeForm } from "./intake-form";

export default async function PublicClientIntakePage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const messages: Record<string, string> = {
    invalid: "Confira os campos obrigatórios e o CPF informado.",
    date: "A data do evento não é válida. Selecione uma data no calendário.",
    time: "O horário informado não é válido. Selecione um horário entre 00:00 e 23:59.",
    cpf: "O CPF informado não é válido.",
    save: "Não foi possível enviar seus dados. Tente novamente.",
  };
  return <main className="public-intake-shell"><section className="public-intake-card">
    <div className="eyebrow">Brindare · Pré-cadastro</div><h1>Vamos preparar sua celebração.</h1>
    <p>Preencha seus dados para que nossa equipe possa preparar o atendimento e os próximos passos do contrato. O cadastro ainda será revisado pela Brindare.</p>
    {error && <div className="error" role="alert">{messages[error] || "Não foi possível validar este formulário."}</div>}
    <IntakeForm token={token}/>
    <small>Seus dados serão utilizados pela Brindare para atendimento e preparação do contrato. O envio não confirma reserva nem contratação.</small>
  </section></main>;
}
