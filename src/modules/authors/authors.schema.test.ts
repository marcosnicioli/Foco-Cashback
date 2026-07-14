import { describe, expect, it } from "vitest";
import { authorFormSchema } from "./authors.schema";

describe("authorFormSchema", () => {
  it("aceita um autor válido e coloca o cupom em maiúsculas", () => {
    const r = authorFormSchema.safeParse({ name: "Letícia Gouveia", coupon: "leticia20" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.coupon).toBe("LETICIA20");
  });

  it("recusa nome curto demais", () => {
    expect(authorFormSchema.safeParse({ name: "A", coupon: "abc" }).success).toBe(false);
  });

  it("recusa cupom curto demais", () => {
    expect(authorFormSchema.safeParse({ name: "Ana Lima", coupon: "a" }).success).toBe(false);
  });

  it("aceita CPF/CNPJ e e-mail vazios (opcionais)", () => {
    const r = authorFormSchema.safeParse({
      name: "Ana Lima",
      coupon: "ana10",
      cpfCnpj: "",
      email: "",
    });
    expect(r.success).toBe(true);
  });

  it("recusa e-mail inválido", () => {
    const r = authorFormSchema.safeParse({
      name: "Ana Lima",
      coupon: "ana10",
      email: "não-é-email",
    });
    expect(r.success).toBe(false);
  });
});
