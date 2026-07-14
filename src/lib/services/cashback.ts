import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CashbackFilter } from "@/modules/cashback/cashback.schema";
import type {
  LedgerEntry,
  LedgerEntryType,
  WithdrawalStatus,
} from "@/modules/cashback/cashback.types";

/**
 * SERVICE = leitura (server-only). Lê a view `cashback_ledger_view`, que já traz
 * o saldo corrente por linha (window function no banco — o saldo nunca é
 * calculado nem armazenado na aplicação).
 */

type LedgerViewRow = {
  id: string;
  author_id: string;
  author_name: string;
  coupon: string | null;
  cpf_cnpj: string | null;
  entry_type: LedgerEntryType;
  order_number: string | null;
  amount: number;
  occurred_at: string;
  notes: string | null;
  withdrawal_status: WithdrawalStatus | null;
  approved_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  effective_amount: number;
  balance_after: number;
};

const LEDGER_COLUMNS =
  "id, author_id, author_name, coupon, cpf_cnpj, entry_type, order_number, amount, occurred_at, notes, withdrawal_status, approved_at, paid_at, cancelled_at, created_at, effective_amount, balance_after";

function toEntry(r: LedgerViewRow): LedgerEntry {
  const balanceAfter = Number(r.balance_after);
  const effective = Number(r.effective_amount);
  return {
    id: r.id,
    authorId: r.author_id,
    authorName: r.author_name,
    coupon: r.coupon ?? "", // view faz coalesce(l.coupon, a.coupon); pode ser null
    cpfCnpj: r.cpf_cnpj,
    entryType: r.entry_type,
    orderNumber: r.order_number,
    amount: Number(r.amount),
    occurredAt: r.occurred_at,
    notes: r.notes,
    withdrawalStatus: r.withdrawal_status,
    balanceAfter,
    balanceBefore: Number((balanceAfter - effective).toFixed(2)),
    approvedAt: r.approved_at,
    paidAt: r.paid_at,
    cancelledAt: r.cancelled_at,
    createdAt: r.created_at,
  };
}

/** Limite de linhas por consulta (paginação/ordenação ficam no client). */
const DEFAULT_LIMIT = 1000;

/**
 * Lista lançamentos para a tela de consulta, aplicando os filtros no banco.
 * IMPORTANTE: os filtros não afetam o cálculo do saldo por linha — a view
 * computa o running balance sobre o histórico completo do autor.
 */
export async function listLedger(filter: CashbackFilter = {}): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  let query = supabase.from("cashback_ledger_view").select(LEDGER_COLUMNS);

  if (filter.coupon?.trim()) query = query.ilike("coupon", `%${filter.coupon.trim()}%`);
  if (filter.author?.trim()) query = query.ilike("author_name", `%${filter.author.trim()}%`);
  if (filter.cpfCnpj?.trim()) query = query.ilike("cpf_cnpj", `%${filter.cpfCnpj.trim()}%`);
  if (filter.orderNumber?.trim())
    query = query.ilike("order_number", `%${filter.orderNumber.trim()}%`);
  if (filter.from) query = query.gte("occurred_at", filter.from);
  if (filter.to) query = query.lte("occurred_at", `${filter.to}T23:59:59`);

  if (filter.status) {
    if (filter.status === "cashback_received") {
      query = query.eq("entry_type", "cashback_received");
    } else {
      query = query.eq("entry_type", "withdrawal").eq("withdrawal_status", filter.status);
    }
  }

  const { data, error } = await query
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false }) // desempate estável (igual à window da view)
    .limit(DEFAULT_LIMIT)
    .returns<LedgerViewRow[]>();

  if (error) {
    console.error(`[cashback] listLedger falhou: ${error.message}`);
    throw error;
  }
  return (data ?? []).map(toEntry);
}

/** Histórico completo de um autor (ordem cronológica) — usado no Drawer. */
export async function getAuthorHistory(authorId: string): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cashback_ledger_view")
    .select(LEDGER_COLUMNS)
    .eq("author_id", authorId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false }) // desempate estável: entries[0] = lançamento mais recente
    .returns<LedgerViewRow[]>();

  if (error) {
    console.error(`[cashback] getAuthorHistory falhou: ${error.message}`);
    throw error;
  }
  return (data ?? []).map(toEntry);
}

/**
 * Fila de resgates por status — usada na Administração (`requested`) e em
 * Pagamentos (`approved`). Ordem FIFO (mais antigos primeiro).
 */
export async function listWithdrawals(status: WithdrawalStatus): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cashback_ledger_view")
    .select(LEDGER_COLUMNS)
    .eq("entry_type", "withdrawal")
    .eq("withdrawal_status", status)
    .order("occurred_at", { ascending: true })
    .order("id", { ascending: true }) // desempate estável (FIFO determinístico)
    .returns<LedgerViewRow[]>();

  if (error) {
    console.error(`[cashback] listWithdrawals(${status}) falhou: ${error.message}`);
    throw error;
  }
  return (data ?? []).map(toEntry);
}
