import { z } from "zod";
const money = z.coerce.number().finite().min(0).max(10_000_000);
const quantity = z.coerce.number().int().min(0).max(999);
const validCpf = (value: string) => {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\\1{10}$/.test(cpf)) return false;
  const digit = (base: string, factor: number) => { let sum = 0; for (const char of base) sum += Number(char) * factor--; const result = (sum * 10) % 11; return result === 10 ? 0 : result; };
  return digit(cpf.slice(0, 9), 10) === Number(cpf[9]) && digit(cpf.slice(0, 10), 11) === Number(cpf[10]);
};
export const contractSchema = z.object({
  clientId: z.string().uuid().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => { const parsed = new Date(`${value}T12:00:00`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; }, "Data do evento inválida."), eventTime: z.string().min(1, "Informe o horário do evento.").max(5), toastTime: z.string().max(5).optional().default(""),
  client: z.string().trim().min(2).max(180), cpf: z.string().trim().min(1).max(18).refine(validCpf, "Informe um CPF válido."), rg: z.string().trim().max(30).optional().default(""),
  phone: z.string().trim().max(13).refine((value) => value === "" || /^\d{10,13}$/.test(value), "Informe somente números no telefone (10 a 13 dígitos).").optional().default(""), email: z.union([z.string().email(), z.literal("")]).optional().default(""),
  address: z.string().trim().min(1, "Informe o endereço do contratante.").max(240), neighborhood: z.string().trim().max(120).optional().default(""), city: z.string().trim().max(120).optional().default(""),
  venue: z.string().trim().min(1, "Informe o local do evento.").max(240), packageName: z.string().trim().min(1).max(120),
  total: money, deposit: money, balance: money, travel: money.optional().default(0), mesa: quantity, tacas: quantity, fogos: quantity, sparkles: quantity, champagne: quantity,
}).superRefine((value, ctx) => { if (value.deposit > value.total) ctx.addIssue({ code: "custom", path: ["deposit"], message: "A entrada não pode ser maior que o valor total." }); if (value.balance !== Math.max(0, Number((value.total - value.deposit).toFixed(2)))) ctx.addIssue({ code: "custom", path: ["balance"], message: "O restante deve ser o valor total menos a entrada." }); });
export type ContractInput = z.infer<typeof contractSchema>;
