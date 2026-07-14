import type { Metadata } from "next";
import { getCurrentUserRole } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/rbac/rbac.config";
import { listAuthorBalances } from "@/lib/services/authors";
import { listLedger } from "@/lib/services/cashback";
import type { CashbackFilter } from "@/modules/cashback/cashback.schema";
import { CashbackClient } from "./cashback-client";
import { CashbackFilters } from "./cashback-filters";

export const metadata: Metadata = { title: "Consulta de Cashback" };

const VALID_STATUS = ["cashback_received", "requested", "approved", "paid", "cancelled"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(sp: SearchParams): CashbackFilter {
  const status = first(sp.status);
  return {
    coupon: first(sp.coupon),
    author: first(sp.author),
    cpfCnpj: first(sp.cpfCnpj),
    orderNumber: first(sp.orderNumber),
    status: VALID_STATUS.includes(status as (typeof VALID_STATUS)[number])
      ? (status as CashbackFilter["status"])
      : undefined,
    from: first(sp.from),
    to: first(sp.to),
  };
}

export default async function CashbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filter = parseFilter(await searchParams);

  const [entries, balances, role] = await Promise.all([
    listLedger(filter),
    listAuthorBalances(),
    getCurrentUserRole(),
  ]);

  const canRequest = hasPermission(role, "withdraw.request");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Consulta de Cashback</h1>
        <p className="text-muted-foreground mt-1">
          Histórico de lançamentos. Clique em uma linha para ver todo o histórico do autor.
        </p>
      </div>

      <CashbackFilters defaults={filter} />

      <CashbackClient entries={entries} balances={balances} canRequest={canRequest} />
    </div>
  );
}
