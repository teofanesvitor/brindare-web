import { z } from "zod";
const money = z.coerce.number().finite().min(0).max(10_000_000);
const quantity = z.coerce.number().int().min(0).max(999);
export const contractSchema = z.object({
  clientId: z.string().uuid().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => { const parsed = new Date(`${value}T12:00:00`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; }, "Data do evento inválida."), eventTime: z.string().max(5).optional().default(""), toastTime: z.string().max(5).optional().default(""),
  client: z.string().trim().min(2).max(180), cpf: z.string().trim().min(1).max(18), rg: z.string().trim().max(30).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""), email: z.union([z.string().email(), z.literal("")]).optional().default(""),
  address: z.string().trim().max(240).optional().default(""), neighborhood: z.string().trim().max(120).optional().default(""), city: z.string().trim().max(120).optional().default(""),
  venue: z.string().trim().min(1, "Informe o local do evento.").max(240), packageName: z.string().trim().min(1).max(120),
  total: money, deposit: money, balance: money, travel: money.optional().default(0), mesa: quantity, tacas: quantity, fogos: quantity, sparkles: quantity, champagne: quantity,
}).superRefine((value, ctx) => { if (value.deposit > value.total) ctx.addIssue({ code: "custom", path: ["deposit"], message: "A entrada não pode ser maior que o valor total." }); if (value.balance !== Math.max(0, Number((value.total - value.deposit).toFixed(2)))) ctx.addIssue({ code: "custom", path: ["balance"], message: "O restante deve ser o valor total menos a entrada." }); });
export type ContractInput = z.infer<typeof contractSchema>;
