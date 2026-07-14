import { describe, expect, it } from "vitest";
import {
  availableBalance,
  canTransition,
  canWithdraw,
  effectiveAmount,
  nextWithdrawalStatuses,
  summarizeLedger,
  WITHDRAWAL_TRANSITIONS,
  type LedgerAmountEntry,
} from "./ledger-rules";

/**
 * Exemplo real (Letícia, do CSV): 3 cashbacks + 1 resgate solicitado.
 *   19.92 + 19.37 + 17.43 = 56.72 gerado; 39.29 solicitado → saldo 17.43.
 */
const leticia: LedgerAmountEntry[] = [
  { entryType: "cashback_received", amount: 19.92, withdrawalStatus: null },
  { entryType: "cashback_received", amount: 19.37, withdrawalStatus: null },
  { entryType: "cashback_received", amount: 17.43, withdrawalStatus: null },
  { entryType: "withdrawal", amount: -39.29, withdrawalStatus: "requested" },
];

describe("availableBalance", () => {
  it("soma créditos e subtrai débitos não-cancelados", () => {
    expect(availableBalance(leticia)).toBe(17.43);
  });

  it("é zero para autor sem lançamentos", () => {
    expect(availableBalance([])).toBe(0);
  });

  it("ignora resgates cancelados (valor volta ao saldo)", () => {
    const entries: LedgerAmountEntry[] = [
      { entryType: "cashback_received", amount: 50, withdrawalStatus: null },
      { entryType: "withdrawal", amount: -30, withdrawalStatus: "cancelled" },
    ];
    expect(availableBalance(entries)).toBe(50);
  });

  it("conta resgates pagos e liberados como débito", () => {
    const entries: LedgerAmountEntry[] = [
      { entryType: "cashback_received", amount: 100, withdrawalStatus: null },
      { entryType: "withdrawal", amount: -40, withdrawalStatus: "paid" },
      { entryType: "withdrawal", amount: -10, withdrawalStatus: "approved" },
    ];
    expect(availableBalance(entries)).toBe(50);
  });

  it("aplica ajustes de crédito e débito", () => {
    const entries: LedgerAmountEntry[] = [
      { entryType: "cashback_received", amount: 20, withdrawalStatus: null },
      { entryType: "adjustment_credit", amount: 5, withdrawalStatus: null },
      { entryType: "adjustment_debit", amount: -3, withdrawalStatus: null },
    ];
    expect(availableBalance(entries)).toBe(22);
  });
});

describe("effectiveAmount", () => {
  it("zera resgate cancelado", () => {
    expect(
      effectiveAmount({ entryType: "withdrawal", amount: -30, withdrawalStatus: "cancelled" }),
    ).toBe(0);
  });

  it("mantém o valor de um resgate pago", () => {
    expect(
      effectiveAmount({ entryType: "withdrawal", amount: -30, withdrawalStatus: "paid" }),
    ).toBe(-30);
  });
});

describe("summarizeLedger", () => {
  it("consolida gerado, pago, bloqueado e saldo (view author_balances)", () => {
    expect(summarizeLedger(leticia)).toEqual({
      totalCredited: 56.72,
      totalPaid: 0,
      blockedAmount: 39.29,
      totalDebited: 0,
      currentBalance: 17.43,
    });
  });

  it("separa pago de bloqueado", () => {
    const entries: LedgerAmountEntry[] = [
      { entryType: "cashback_received", amount: 100, withdrawalStatus: null },
      { entryType: "withdrawal", amount: -40, withdrawalStatus: "paid" },
      { entryType: "withdrawal", amount: -25, withdrawalStatus: "requested" },
      { entryType: "withdrawal", amount: -15, withdrawalStatus: "cancelled" },
    ];
    expect(summarizeLedger(entries)).toEqual({
      totalCredited: 100,
      totalPaid: 40,
      blockedAmount: 25,
      totalDebited: 0,
      currentBalance: 35, // 100 - 40 - 25 (cancelado devolve)
    });
  });

  it("contabiliza ajustes de crédito e débito e reconcilia o saldo", () => {
    const entries: LedgerAmountEntry[] = [
      { entryType: "cashback_received", amount: 100, withdrawalStatus: null },
      { entryType: "adjustment_credit", amount: 10, withdrawalStatus: null },
      { entryType: "adjustment_debit", amount: -8, withdrawalStatus: null },
    ];
    const s = summarizeLedger(entries);
    expect(s).toEqual({
      totalCredited: 110, // 100 + 10
      totalPaid: 0,
      blockedAmount: 0,
      totalDebited: 8,
      currentBalance: 102, // 110 - 8
    });
    // Reconciliação: saldo = creditado − pago − bloqueado − debitado.
    expect(s.currentBalance).toBe(s.totalCredited - s.totalPaid - s.blockedAmount - s.totalDebited);
  });
});

describe("canWithdraw", () => {
  it("permite resgatar exatamente o saldo disponível", () => {
    expect(canWithdraw(17.43, 17.43)).toBe(true);
  });

  it("recusa valor acima do saldo (nem 1 centavo a mais)", () => {
    expect(canWithdraw(17.43, 17.44)).toBe(false);
  });

  it("recusa valor zero ou negativo", () => {
    expect(canWithdraw(100, 0)).toBe(false);
    expect(canWithdraw(100, -5)).toBe(false);
  });

  it("recusa qualquer resgate quando o saldo é zero", () => {
    expect(canWithdraw(0, 0.01)).toBe(false);
  });
});

describe("transições de status de resgate", () => {
  it("permite solicitado → liberado/cancelado", () => {
    expect(canTransition("requested", "approved")).toBe(true);
    expect(canTransition("requested", "cancelled")).toBe(true);
  });

  it("permite liberado → pago/cancelado", () => {
    expect(canTransition("approved", "paid")).toBe(true);
    expect(canTransition("approved", "cancelled")).toBe(true);
  });

  it("proíbe pular solicitado → pago", () => {
    expect(canTransition("requested", "paid")).toBe(false);
  });

  it("trata pago e cancelado como estados finais", () => {
    expect(nextWithdrawalStatuses("paid")).toEqual([]);
    expect(nextWithdrawalStatuses("cancelled")).toEqual([]);
    expect(canTransition("paid", "cancelled")).toBe(false);
  });

  it("expõe as transições a partir de cada status", () => {
    expect(WITHDRAWAL_TRANSITIONS.requested).toEqual(["approved", "cancelled"]);
    expect(WITHDRAWAL_TRANSITIONS.approved).toEqual(["paid", "cancelled"]);
  });
});
