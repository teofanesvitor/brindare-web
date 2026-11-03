import { describe, expect, it } from "vitest";
import { parseAdminEmails } from "../src/lib/validation/admin-emails";

describe("parseAdminEmails", () => {
  it("aceita um administrador e normaliza o e-mail", () => {
    expect(parseAdminEmails(" ADMIN@EXAMPLE.COM ")).toEqual(["admin@example.com"]);
  });
  it("aceita até cinco e-mails distintos", () => {
    expect(parseAdminEmails("a@example.com,b@example.com,c@example.com,d@example.com,e@example.com")).toHaveLength(5);
  });
  it("rejeita mais de cinco e-mails", () => {
    expect(() => parseAdminEmails("a@example.com,b@example.com,c@example.com,d@example.com,e@example.com,f@example.com")).toThrow(/entre 1 e 5/);
  });
  it("rejeita e-mails duplicados", () => {
    expect(() => parseAdminEmails("a@example.com,a@example.com")).toThrow(/distintos/);
  });
  it("rejeita e-mail inválido", () => {
    expect(() => parseAdminEmails("nao-e-email")).toThrow();
  });
});
