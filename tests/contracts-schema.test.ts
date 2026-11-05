import { describe, expect, it } from "vitest";
import { contractSchema } from "@/lib/contracts/schema";

const validInput = (overrides: Record<string, unknown> = {}) => ({
  eventDate: "2027-01-09",
  eventTime: "18:00",
  toastTime: "",
  client: "Cliente Teste",
  cpf: "529.982.247-25",
  rg: "",
  phone: "(11) 9 8765-4321",
  email: "",
  address: "Rua de Teste, 100",
  neighborhood: "",
  city: "Maceió",
  venue: "Espaço Teste",
  packageName: "Celebração",
  total: "750.00",
  deposit: "300.00",
  balance: "450.00",
  travel: "100.00",
  mesa: "0",
  tacas: "30",
  fogos: "0",
  sparkles: "0",
  champagne: "0",
  ...overrides,
});

describe("validação e normalização do contrato", () => {
  it("normaliza CPF formatado para 11 dígitos e valida seus verificadores", () => {
    const result = contractSchema.safeParse(validInput());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cpf).toBe("52998224725");
  });

  it("normaliza celular formatado para 11 dígitos", () => {
    const result = contractSchema.safeParse(validInput());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe("11987654321");
  });

  it("rejeita celular que não possui 11 dígitos", () => {
    const result = contractSchema.safeParse(validInput({ phone: "(11) 8765-4321" }));
    expect(result.success).toBe(false);
  });

  it("rejeita CPF inválido", () => {
    const result = contractSchema.safeParse(validInput({ cpf: "111.111.111-11" }));
    expect(result.success).toBe(false);
  });

  it.each([
    ["Essencial", 450],
    ["Celebração", 650],
    ["Luxo", 900],
  ] as const)("valida o preço fixo do pacote %s", (packageName, price) => {
    const result = contractSchema.safeParse(validInput({
      packageName,
      total: String(price + 100),
      travel: "100",
      deposit: "300",
      balance: String(price + 100 - 300),
    }));
    expect(result.success).toBe(true);
  });

  it("rejeita total diferente do preço do pacote mais deslocamento", () => {
    const result = contractSchema.safeParse(validInput({ total: "800.00" }));
    expect(result.success).toBe(false);
  });
});
