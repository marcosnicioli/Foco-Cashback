import { describe, expect, it } from "vitest";
import { hasAnyPermission, hasPermission } from "./rbac.config";

describe("hasPermission", () => {
  it("admin pode tudo (inclui ações administrativas)", () => {
    expect(hasPermission("admin", "import.run")).toBe(true);
    expect(hasPermission("admin", "ledger.adjust")).toBe(true);
    expect(hasPermission("admin", "users.manage")).toBe(true);
    expect(hasPermission("admin", "withdraw.pay")).toBe(true);
  });

  it("operator toca no fluxo de resgate, mas não em ações administrativas", () => {
    expect(hasPermission("operator", "withdraw.request")).toBe(true);
    expect(hasPermission("operator", "withdraw.approve")).toBe(true);
    expect(hasPermission("operator", "withdraw.pay")).toBe(true);
    expect(hasPermission("operator", "withdraw.cancel")).toBe(true);
    expect(hasPermission("operator", "authors.write")).toBe(true);
    expect(hasPermission("operator", "import.run")).toBe(false);
    expect(hasPermission("operator", "ledger.adjust")).toBe(false);
    expect(hasPermission("operator", "users.manage")).toBe(false);
  });

  it("viewer só lê", () => {
    expect(hasPermission("viewer", "cashback.read")).toBe(true);
    expect(hasPermission("viewer", "authors.write")).toBe(false);
    expect(hasPermission("viewer", "withdraw.request")).toBe(false);
  });

  it("é deny-by-default (sem permissão listada = negado)", () => {
    expect(hasPermission("viewer", "import.run")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("true se o papel tem ao menos uma das permissões", () => {
    expect(hasAnyPermission("viewer", ["authors.write", "cashback.read"])).toBe(true);
  });

  it("false se não tem nenhuma", () => {
    expect(hasAnyPermission("viewer", ["import.run", "users.manage"])).toBe(false);
  });

  it("false para lista vazia", () => {
    expect(hasAnyPermission("admin", [])).toBe(false);
  });
});
