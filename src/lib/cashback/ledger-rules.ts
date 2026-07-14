/**
 * Regras de negócio do ledger, em TypeScript.
 *
 * Este módulo é o ESPELHO fiel — testável — das regras que o banco garante em
 * SQL (migration `..._cashback_schema.sql`): função `author_available_balance`,
 * view `author_balances`, trigger `enforce_non_negative_balance` e trigger
 * `guard_ledger_update` (transições de status).
 *
 * O BANCO continua sendo a autoridade final (constraints + triggers + RLS).
 * Estas funções existem para (a) validar/decidir no app antes de bater no banco
 * — defesa em profundidade e melhor UX — usando exatamente a mesma lógica, e
 * (b) permitir testes unitários das regras que, no banco, só rodariam com uma
 * conexão real. Se a regra mudar no SQL, mude aqui também (e vice-versa).
 */
import type { LedgerEntryType, WithdrawalStatus } from "@/modules/cashback/cashback.types";

/** Arredonda para 2 casas (centavos), como o `numeric(14,2)` do banco. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Transições de status (espelha guard_ledger_update)
// ---------------------------------------------------------------------------

/**
 * Transições de status permitidas para um resgate. `paid` e `cancelled` são
 * estados finais (sem saída). Espelha exatamente o trigger `guard_ledger_update`.
 */
export const WITHDRAWAL_TRANSITIONS: Record<WithdrawalStatus, readonly WithdrawalStatus[]> = {
  requested: ["approved", "cancelled"],
  approved: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

/** A transição `from → to` é permitida? */
export function canTransition(from: WithdrawalStatus, to: WithdrawalStatus): boolean {
  return WITHDRAWAL_TRANSITIONS[from].includes(to);
}

/** Próximos status possíveis a partir de `from` (vazio se estado final). */
export function nextWithdrawalStatuses(from: WithdrawalStatus): readonly WithdrawalStatus[] {
  return WITHDRAWAL_TRANSITIONS[from];
}

// ---------------------------------------------------------------------------
// Cálculo de saldo (espelha author_available_balance / author_balances)
// ---------------------------------------------------------------------------

/** Campos mínimos de um lançamento para o cálculo de saldo. */
export interface LedgerAmountEntry {
  entryType: LedgerEntryType;
  /** Valor COM sinal: crédito (+), débito (−). */
  amount: number;
  withdrawalStatus: WithdrawalStatus | null;
}

/** Um resgate cancelado devolveu o valor: não conta no saldo. */
export function isCancelledWithdrawal(entry: {
  entryType: LedgerEntryType;
  withdrawalStatus: WithdrawalStatus | null;
}): boolean {
  return entry.entryType === "withdrawal" && entry.withdrawalStatus === "cancelled";
}

/** Valor que efetivamente move o saldo (resgate cancelado = 0). */
export function effectiveAmount(entry: LedgerAmountEntry): number {
  return isCancelledWithdrawal(entry) ? 0 : entry.amount;
}

/**
 * Saldo disponível do autor = SOMA(amount) ignorando resgates cancelados.
 * Espelha `author_available_balance`. Nunca deveria ser negativo.
 */
export function availableBalance(entries: readonly LedgerAmountEntry[]): number {
  const sum = entries.reduce((acc, e) => acc + effectiveAmount(e), 0);
  return round2(sum);
}

/** Resumo consolidado por autor. Espelha a view `author_balances`. */
export interface BalanceSummary {
  /** Σ créditos (cashback recebido + ajustes de crédito). */
  totalCredited: number;
  /** Σ resgates pagos (valor positivo). */
  totalPaid: number;
  /** Σ resgates bloqueados: solicitados + liberados, ainda não pagos (positivo). */
  blockedAmount: number;
  /** Σ ajustes de débito (valor positivo). */
  totalDebited: number;
  /** Saldo disponível atual. */
  currentBalance: number;
}

export function summarizeLedger(entries: readonly LedgerAmountEntry[]): BalanceSummary {
  let totalCredited = 0;
  let totalPaid = 0;
  let blockedAmount = 0;
  let totalDebited = 0;

  for (const e of entries) {
    if (e.entryType === "cashback_received" || e.entryType === "adjustment_credit") {
      totalCredited += e.amount;
    }
    if (e.entryType === "withdrawal" && e.withdrawalStatus === "paid") {
      totalPaid += -e.amount;
    }
    if (
      e.entryType === "withdrawal" &&
      (e.withdrawalStatus === "requested" || e.withdrawalStatus === "approved")
    ) {
      blockedAmount += -e.amount;
    }
    if (e.entryType === "adjustment_debit") {
      totalDebited += -e.amount;
    }
  }

  return {
    totalCredited: round2(totalCredited),
    totalPaid: round2(totalPaid),
    blockedAmount: round2(blockedAmount),
    totalDebited: round2(totalDebited),
    currentBalance: availableBalance(entries),
  };
}

// ---------------------------------------------------------------------------
// Trava de saldo negativo (espelha enforce_non_negative_balance)
// ---------------------------------------------------------------------------

/**
 * É possível debitar `amount` (positivo) de um saldo disponível `available`?
 * Regra: valor > 0 (schema) e saldo resultante ≥ 0 (trava do banco).
 */
export function canWithdraw(available: number, amount: number): boolean {
  return amount > 0 && round2(available - amount) >= 0;
}
