import { describe, expect, it } from "vitest";
import { calculateInventoryBalance } from "@/lib/inventory";

describe("saldo do estoque", () => {
  it("soma entradas e desconta saídas", () => {
    expect(calculateInventoryBalance([
      { movement_type: "entrada", quantity: "90" },
      { movement_type: "saida", quantity: "12" },
      { movement_type: "entrada", quantity: 5 },
    ])).toBe(83);
  });

  it("mantém ajustes positivos conforme o histórico da aplicação", () => {
    expect(calculateInventoryBalance([
      { movement_type: "entrada", quantity: 10 },
      { movement_type: "ajuste", quantity: 2 },
      { movement_type: "saida", quantity: 3 },
    ])).toBe(9);
  });

  it("não mascara saldo negativo nem valores inválidos", () => {
    expect(calculateInventoryBalance([
      { movement_type: "saida", quantity: 4 },
      { movement_type: "entrada", quantity: "inválido" },
    ])).toBe(-4);
  });
});
