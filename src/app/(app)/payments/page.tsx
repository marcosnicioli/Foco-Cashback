import type { Metadata } from "next";
import { getCurrentUserRole } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/rbac/rbac.config";
import { listWithdrawals } from "@/lib/services/cashback";
import { AccessDenied } from "@/components/access-denied";
import { WithdrawalsTable } from "@/components/cashback/withdrawals-table";

export const metadata: Metadata = { title: "Pagamentos" };

export default async function PaymentsPage() {
  const role = await getCurrentUserRole();
  if (!hasPermission(role, "withdraw.pay")) return <AccessDenied />;

  const entries = await listWithdrawals("approved");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pagamentos</h1>
        <p className="text-muted-foreground mt-1">
          Resgates liberados aguardando pagamento. Ao confirmar, o valor deixa definitivamente o
          saldo do autor.
        </p>
      </div>

      <WithdrawalsTable entries={entries} variant="payments" />
    </div>
  );
}
