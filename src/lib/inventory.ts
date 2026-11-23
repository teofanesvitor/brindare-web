export type InventoryMovement = {
  movement_type: string;
  quantity: number | string;
};

/**
 * Recalcula o saldo pelo livro completo de movimentações.
 * Saídas reduzem o saldo; entradas e ajustes preservam a convenção histórica de soma.
 * Não limita o resultado a zero: saldo negativo deve continuar visível para auditoria.
 */
export function calculateInventoryBalance(movements: InventoryMovement[]): number {
  return movements.reduce((balance, movement) => {
    const quantity = Number(movement.quantity);
    if (!Number.isFinite(quantity)) return balance;

    if (movement.movement_type === "entrada") return balance + quantity;
    if (movement.movement_type === "saida") return balance - quantity;
    return balance + quantity;
  }, 0);
}
