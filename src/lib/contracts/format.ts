const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (!n) return "";
  if (n < 10) return unidades[n];
  if (n < 20) return especiais[n - 10];
  if (n < 100) return dezenas[Math.floor(n / 10)] + (n % 10 ? ` e ${unidades[n % 10]}` : "");
  if (n === 100) return "cem";
  return centenas[Math.floor(n / 100)] + (n % 100 ? ` e ${ate999(n % 100)}` : "");
}
function inteiroExtenso(n: number): string {
  if (n < 1000) return ate999(n);
  if (n < 1_000_000) {
    const milhar = Math.floor(n / 1000), resto = n % 1000;
    return (milhar === 1 ? "mil" : `${ate999(milhar)} mil`) + (resto ? ` e ${ate999(resto)}` : "");
  }
  if (n < 1_000_000_000) {
    const milhoes = Math.floor(n / 1_000_000), resto = n % 1_000_000;
    let texto = milhoes === 1 ? "um milhão" : `${inteiroExtenso(milhoes)} milhões`;
    if (resto) texto += resto < 1000 ? ` e ${inteiroExtenso(resto)}` : ` ${inteiroExtenso(resto)}`;
    return texto;
  }
  throw new Error("Valor acima do limite suportado para conversão por extenso.");
}
export function numeroPorExtenso(value: number): string {
  if (!Number.isFinite(value) || value < 0) throw new Error("Valor monetário inválido.");
  const centsTotal = Math.round(value * 100);
  const inteiro = Math.floor(centsTotal / 100), centavos = centsTotal % 100;
  let result = inteiro === 0 ? "zero reais" : `${inteiroExtenso(inteiro)} ${inteiro === 1 ? "real" : "reais"}`;
  if (centavos) result += ` e ${inteiroExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  return result;
}
export function moeda(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function itensDoPacote(input: { mesa: number; tacas: number; fogos: number; sparkles: number; champagne: number }): string {
  const itens: string[] = [];
  if (input.mesa > 0) itens.push("• Mesa de apoio;");
  if (input.tacas > 0) itens.push(`• ${input.tacas} taças de vidro;`);
  if (input.fogos > 0) itens.push(`• ${String(input.fogos).padStart(2, "0")} ${input.fogos === 1 ? "par" : "pares"} de fogos indoor;`);
  if (input.sparkles > 0) itens.push(`• ${String(input.sparkles).padStart(2, "0")} ${input.sparkles === 1 ? "sparkle" : "sparkles"};`);
  if (input.champagne > 0) itens.push(`• ${String(input.champagne).padStart(2, "0")} ${input.champagne === 1 ? "unidade" : "unidades"} de champagne;`);
  itens.push("• Montagem e organização do cenário.");
  return itens.join("\n");
}
export function nomeContrato(cliente: string, date: string): string {
  const nome = cliente.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().replace(/\s+/g, "_");
  const [year, month, day] = date.split("-");
  return `CONTRATO_TORRE_DE_CHAMPAGNE_${nome}_${day}-${month}-${year}`;
}
