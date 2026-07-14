import type { Metadata } from "next";
import { Banknote, Clock, PiggyBank, Users, Wallet, type LucideIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getDashboardMetrics } from "@/lib/services/dashboard";
import { StatusBadge } from "@/components/cashback/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

function MetricCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const [user, metrics] = await Promise.all([getCurrentUser(), getDashboardMetrics()]);
  const firstName = user?.fullName?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName} 👋</h1>
        <p className="text-muted-foreground mt-1">Visão geral do programa de cashback.</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          title="Cashback gerado"
          value={formatCurrency(metrics.totalGenerated)}
          icon={Wallet}
          hint="Total creditado (histórico)"
        />
        <MetricCard
          title="Total pago"
          value={formatCurrency(metrics.totalPaid)}
          icon={Banknote}
          hint="Resgates efetivamente pagos"
        />
        <MetricCard
          title="Em resgate"
          value={formatCurrency(metrics.totalRequested)}
          icon={Clock}
          hint="Solicitado/liberado, ainda não pago"
        />
        <MetricCard
          title="Saldo total"
          value={formatCurrency(metrics.totalBalance)}
          icon={PiggyBank}
          hint="Disponível somando os autores"
        />
        <MetricCard
          title="Autores"
          value={String(metrics.authorsCount)}
          icon={Users}
          hint="Cadastrados no programa"
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Últimos resgates solicitados</h2>
        <Card>
          <CardContent className="p-0">
            {metrics.lastWithdrawals.length === 0 ? (
              <p className="text-muted-foreground p-6 text-center text-sm">
                Nenhum resgate solicitado no momento.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {metrics.lastWithdrawals.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{w.authorName}</p>
                      <p className="text-muted-foreground text-xs">
                        {w.coupon} · {formatDateTime(w.occurredAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatCurrency(Math.abs(w.amount))}</span>
                      <StatusBadge entryType={w.entryType} withdrawalStatus={w.withdrawalStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
