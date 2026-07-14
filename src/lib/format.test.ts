import { describe, expect, it } from "vitest";
import { formatCpfCnpj, formatCurrency, formatDate, formatDateTime } from "./format";

/** Normaliza espaços (o Intl usa espaço fino/insecável entre R$ e o número). */
const norm = (s: string) => s.replace(/\s+/g, " ");

describe("formatCurrency", () => {
  it("formata em BRL com separadores PT-BR", () => {
    expect(norm(formatCurrency(1234.5))).toBe("R$ 1.234,50");
  });

  it("trata null/undefined como zero", () => {
    expect(norm(formatCurrency(null))).toBe("R$ 0,00");
    expect(norm(formatCurrency(undefined))).toBe("R$ 0,00");
  });

  it("mostra valores negativos", () => {
    expect(norm(formatCurrency(-39.29))).toBe("-R$ 39,29");
  });
});

describe("formatDate", () => {
  it("formata ISO como dd/mm/aaaa", () => {
    expect(formatDate("2025-01-21T12:00:00Z")).toBe("21/01/2025");
  });

  it("retorna travessão para vazio/nulo", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("retorna travessão para data inválida", () => {
    expect(formatDate("não é data")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("inclui hora e minuto", () => {
    expect(formatDateTime("2025-01-21T12:00:00Z")).toMatch(/^21\/01\/2025,? \d{2}:\d{2}$/);
  });

  it("retorna travessão para nulo", () => {
    expect(formatDateTime(null)).toBe("—");
  });
});

describe("formatCpfCnpj", () => {
  it("formata CPF (11 dígitos)", () => {
    expect(formatCpfCnpj("12345678901")).toBe("123.456.789-01");
  });

  it("formata CNPJ (14 dígitos)", () => {
    expect(formatCpfCnpj("12345678000199")).toBe("12.345.678/0001-99");
  });

  it("devolve o valor original se não for CPF nem CNPJ", () => {
    expect(formatCpfCnpj("123")).toBe("123");
  });

  it("retorna travessão para nulo/vazio", () => {
    expect(formatCpfCnpj(null)).toBe("—");
    expect(formatCpfCnpj("")).toBe("—");
  });
});
