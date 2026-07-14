import { describe, expect, it } from "vitest";
import { adjustmentSchema, cashbackFilterSchema, withdrawRequestSchema } from "./cashback.schema";

const AUTHOR_ID = "11111111-1111-1111-1111-111111111111";

describe("withdrawRequestSchema", () => {
  it("aceita um pedido válido", () => {
    const r = withdrawRequestSchema.safeParse({ authorId: AUTHOR_ID, amount: 17.43 });
    expect(r.success).toBe(true);
  });

  it("coage string numérica para número", () => {
    const r = withdrawRequestSchema.safeParse({ authorId: AUTHOR_ID, amount: "10.50" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(10.5);
  });

  it("recusa valor zero ou negativo", () => {
    expect(withdrawRequestSchema.safeParse({ authorId: AUTHOR_ID, amount: 0 }).success).toBe(false);
    expect(withdrawRequestSchema.safeParse({ authorId: AUTHOR_ID, amount: -5 }).success).toBe(
      false,
    );
  });

  it("recusa mais de 2 casas decimais", () => {
    expect(withdrawRequestSchema.safeParse({ authorId: AUTHOR_ID, amount: 12.345 }).success).toBe(
      false,
    );
  });

  it("recusa authorId que não é uuid", () => {
    expect(withdrawRequestSchema.safeParse({ authorId: "abc", amount: 10 }).success).toBe(false);
  });

  it("recusa observação longa demais", () => {
    const r = withdrawRequestSchema.safeParse({
      authorId: AUTHOR_ID,
      amount: 10,
      notes: "x".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe("adjustmentSchema", () => {
  it("aceita crédito com motivo", () => {
    const r = adjustmentSchema.safeParse({
      authorId: AUTHOR_ID,
      direction: "credit",
      amount: 10,
      notes: "correção de importação",
    });
    expect(r.success).toBe(true);
  });

  it("exige uma direção válida", () => {
    const r = adjustmentSchema.safeParse({
      authorId: AUTHOR_ID,
      direction: "outro",
      amount: 10,
      notes: "motivo",
    });
    expect(r.success).toBe(false);
  });

  it("exige um motivo (mín. 3 caracteres)", () => {
    const r = adjustmentSchema.safeParse({
      authorId: AUTHOR_ID,
      direction: "debit",
      amount: 10,
      notes: "x",
    });
    expect(r.success).toBe(false);
  });
});

describe("cashbackFilterSchema", () => {
  it("aceita filtros vazios", () => {
    expect(cashbackFilterSchema.safeParse({}).success).toBe(true);
  });

  it("recusa status desconhecido", () => {
    expect(cashbackFilterSchema.safeParse({ status: "inexistente" }).success).toBe(false);
  });

  it("aceita um status válido", () => {
    expect(cashbackFilterSchema.safeParse({ status: "paid" }).success).toBe(true);
  });
});
