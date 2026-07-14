import type { Metadata } from "next";
import { getCurrentUserRole } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/rbac/rbac.config";
import { listWithdrawals } from "@/lib/services/cashback";
import { AccessDenied } from "@/components/access-denied";
import { WithdrawalsTable } from "@/components/cashback/withdrawals-table";

export const metadata: Metadata = { title: "Administração de Resgates" };

export default async function WithdrawalsPage() {
  const role = await getCurrentUserRole();
  if (!hasPermission(role, "withdraw.approve")) return <AccessDenied />;

  const entries = await listWithdrawals("requested");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração de Resgates</h1>
        <p className="text-muted-foreground mt-1">
          Resgates solicitados aguardando aprovação. Ao aprovar, o resgate fica liberado para
          pagamento.
        </p>
      </div>

      <WithdrawalsTable entries={entries} variant="administration" />
    </div>
  );
}
