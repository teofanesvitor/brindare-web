import { submitClientIntake } from "@/actions/operations";

export default async function PublicClientIntakePage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  return <main className="public-intake-shell"><section className="public-intake-card">
    <div className="eyebrow">Brindare · Pré-cadastro</div><h1>Vamos preparar sua celebração.</h1>
    <p>Preencha seus dados para que nossa equipe possa preparar o atendimento e os próximos passos do contrato. O cadastro ainda será revisado pela Brindare.</p>
    {error && <div className="error">Confira nome, telefone e e-mail e tente novamente.</div>}
    <form action={submitClientIntake} className="operation-form">
      <input type="hidden" name="token" value={token}/>
      <label>Nome completo *<input name="full_name" required minLength={3} autoComplete="name"/></label>
      <label>Telefone / WhatsApp *<input name="phone" required autoComplete="tel" placeholder="(00) 00000-0000"/></label>
      <label>E-mail *<input name="email" type="email" required autoComplete="email"/></label>
      <label>CPF<input name="cpf" inputMode="numeric"/></label>
      <label>RG<input name="rg"/></label>
      <label>Endereço<input name="address" autoComplete="street-address"/></label>
      <label>Bairro<input name="neighborhood"/></label>
      <label>Município<input name="city" defaultValue="Maceió"/></label>
      <label>Data do evento<input name="event_date" type="date"/></label>
      <label>Horário<input name="event_time" type="time"/></label>
      <label>Local do evento<input name="venue" placeholder="Espaço ou endereço"/></label>
      <label>Cerimonial<input name="ceremony_contact"/></label>
      <label>Indicação<input name="referral" placeholder="Como conheceu a Brindare?"/></label>
      <button className="operation-submit" type="submit">Enviar meus dados</button>
    </form>
    <small>Seus dados serão utilizados pela Brindare para atendimento e preparação do contrato. O envio não confirma reserva nem contratação.</small>
  </section></main>;
}
