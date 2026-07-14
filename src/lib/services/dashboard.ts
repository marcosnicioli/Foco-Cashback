import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listWithdrawals } from "@/lib/services/cashback";
import type { LedgerEntry } from "@/modules/cashback/cashback.types";

export interface DashboardMetrics {
  /** Total de cashback gerado (créditos: cashback + ajustes de crédito). */
  totalGenerated: number;
  /** Total efetivamente pago em resgates. */
  totalPaid: number;
  /** Total bloqueado em resgates solicitados/liberados (ainda não pagos). */
  totalRequested: number;
  /** Saldo total disponível somando todos os autores. */
  totalBalance: number;
  /** Quantidade de autores cadastrados. */
  authorsCount: number;
  /** Últimos resgates solicitados (para a lista do dashboard). */
  lastWithdrawals: LedgerEntry[];
}

type BalanceAggRow = {
  total_credited: number;
  total_paid: number;
  blocked_amount: number;
  current_balance: number;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("author_balances")
    .select("total_credited, total_paid, blocked_amount, current_balance")
    .returns<BalanceAggRow[]>();

  if (error) {
    console.error(`[dashboard] getDashboardMetrics falhou: ${error.message}`);
    throw error;
  }

  const rows = data ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      totalGenerated: acc.totalGenerated + Number(r.total_credited),
      totalPaid: acc.totalPaid + Number(r.total_paid),
      totalRequested: acc.totalRequested + Number(r.blocked_amount),
      totalBalance: acc.totalBalance + Number(r.current_balance),
    }),
    { totalGenerated: 0, totalPaid: 0, totalRequested: 0, totalBalance: 0 },
  );

  // Resgates aguardando aprovação (mais recentes primeiro, top 5).
  const requested = await listWithdrawals("requested");
  const lastWithdrawals = [...requested]
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
    .slice(0, 5);

  return {
    ...totals,
    authorsCount: rows.length,
    lastWithdrawals,
  };
}
