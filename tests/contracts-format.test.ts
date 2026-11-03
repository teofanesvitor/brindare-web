import { describe, expect, it } from "vitest";
import { itensDoPacote, moeda, nomeContrato, numeroPorExtenso } from "@/lib/contracts/format";

describe("formatação de contratos Brindare", () => {
  it("converte valores monetários para extenso com reais e centavos", () => {
    expect(numeroPorExtenso(560)).toBe("quinhentos e sessenta reais");
    expect(numeroPorExtenso(1)).toBe("um real");
    expect(numeroPorExtenso(1.01)).toBe("um real e um centavo");
    expect(numeroPorExtenso(0)).toBe("zero reais");
  });
  it("formata moeda brasileira", () => expect(moeda(1234.5)).toBe("1.234,50"));
  it("preserva singular, plural e composição dos itens", () => {
    expect(itensDoPacote({ mesa: 1, tacas: 2, fogos: 1, sparkles: 2, champagne: 1 })).toContain("01 par de fogos indoor;");
    expect(itensDoPacote({ mesa: 0, tacas: 0, fogos: 0, sparkles: 0, champagne: 0 })).toBe("• Montagem e organização do cenário.");
  });
  it("gera nome de arquivo normalizado no padrão legado", () => {
    expect(nomeContrato("João da Silva", "2026-12-05")).toBe("CONTRATO_TORRE_DE_CHAMPAGNE_JOAO_DA_SILVA_05-12-2026");
  });
});
