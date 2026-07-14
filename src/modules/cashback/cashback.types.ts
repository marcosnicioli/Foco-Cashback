/** Tipos do domínio de Cashback (ledger). */

export type LedgerEntryType =
  | "cashback_received"
  | "withdrawal"
  | "adjustment_credit"
  | "adjustment_debit";

export type WithdrawalStatus = "requested" | "approved" | "paid" | "cancelled";

/**
 * Uma linha do ledger enriquecida com dados do autor e saldo corrente
 * (view `cashback_ledger_view`). É o que a tela de consulta exibe.
 */
export interface LedgerEntry {
  id: string;
  authorId: string;
  authorName: string;
  coupon: string;
  cpfCnpj: string | null;
  entryType: LedgerEntryType;
  orderNumber: string | null;
  amount: number;
  occurredAt: string;
  notes: string | null;
  withdrawalStatus: WithdrawalStatus | null;
  /** Saldo depois deste lançamento (running balance por autor). */
  balanceAfter: number;
  /** Saldo antes deste lançamento (= balanceAfter − valor efetivo). */
  balanceBefore: number;
  approvedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

/** Rótulos PT-BR do tipo de lançamento. */
export const ENTRY_TYPE_LABELS: Record<LedgerEntryType, string> = {
  cashback_received: "Cashback Recebido",
  withdrawal: "Resgate",
  adjustment_credit: "Ajuste (Crédito)",
  adjustment_debit: "Ajuste (Débito)",
};

/** Rótulos PT-BR do status de resgate. */
export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  requested: "Resgate Solicitado",
  approved: "Resgate Liberado",
  paid: "Resgate Pago",
  cancelled: "Resgate Cancelado",
};

/**
 * Rótulo da coluna "Situação" (como no sistema atual): combina tipo + status.
 * Ex.: withdrawal + requested → "Resgate Solicitado".
 */
export function situationLabel(entry: {
  entryType: LedgerEntryType;
  withdrawalStatus: WithdrawalStatus | null;
}): string {
  if (entry.entryType === "withdrawal" && entry.withdrawalStatus) {
    return WITHDRAWAL_STATUS_LABELS[entry.withdrawalStatus];
  }
  return ENTRY_TYPE_LABELS[entry.entryType];
}
