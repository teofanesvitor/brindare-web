import { z } from "zod";

const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());

/** Aceita de 1 a 5 administradores; a lista vem exclusivamente do ambiente. */
export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw?.trim()) throw new Error("Defina ADMIN_EMAILS com pelo menos um e-mail.");
  const emails = raw.split(",").map((item) => emailSchema.parse(item));
  if (emails.length < 1 || emails.length > 5) {
    throw new Error(`Informe entre 1 e 5 e-mails; recebidos: ${emails.length}.`);
  }
  if (new Set(emails).size !== emails.length) {
    throw new Error("Os e-mails precisam ser distintos.");
  }
  return emails;
}
