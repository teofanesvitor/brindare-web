"use client";

import { deleteConvertedIntakePayload } from "@/actions/client-intakes";

export function DeleteIntakeDataButton({ intakeId }: { intakeId: string }) {
  return <form action={deleteConvertedIntakePayload} onSubmit={(event) => {
    if (!window.confirm("Excluir permanentemente os dados enviados neste pré-cadastro? O cliente e o contrato permanecerão salvos.")) {
      event.preventDefault();
    }
  }}>
    <input type="hidden" name="intake_id" value={intakeId}/>
    <button className="operation-link" type="submit">Excluir dados enviados</button>
  </form>;
}
