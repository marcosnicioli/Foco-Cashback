"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchAuthorHistory } from "@/lib/actions/cashback-queries";
import { formatCurrency, formatCpfCnpj, formatDateTime } from "@/lib/format";
import type { LedgerEntry } from "@/modules/cashback/cashback.types";
import { StatusBadge } from "@/components/cashback/status-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface DrawerAuthor {
  id: string;
  name: string;
  coupon: string;
  cpfCnpj: string | null;
}

export function AuthorHistoryDrawer({
  author,
  onClose,
}: {
  author: DrawerAuthor | null;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!author) return;
    let active = true;
    setLoading(true);
    fetchAuthorHistory(author.id)
      .then((data) => {
        if (active) setEntries(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [author]);

  const currentBalance = entries[0]?.balanceAfter ?? 0;

  return (
    <Sheet open={!!author} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {author && (
          <>
            <SheetHeader>
              <SheetTitle>{author.name}</SheetTitle>
              <SheetDescription>
                Cupom <span className="font-medium">{author.coupon}</span> ·{" "}
                {formatCpfCnpj(author.cpfCnpj)}
              </SheetDescription>
            </SheetHeader>

            <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border p-4">
              <span className="text-muted-foreground text-sm">Saldo atual</span>
              <span className="text-xl font-semibold">{formatCurrency(currentBalance)}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…
                </div>
              ) : entries.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  Nenhum lançamento para este autor.
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <StatusBadge
                          entryType={e.entryType}
                          withdrawalStatus={e.withdrawalStatus}
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                          {formatDateTime(e.occurredAt)}
                          {e.orderNumber ? ` · Pedido ${e.orderNumber}` : ""}
                        </p>
                        {e.notes && (
                          <p className="text-muted-foreground mt-0.5 text-xs">{e.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "font-medium",
                            e.amount < 0 ? "text-destructive" : "text-success",
                          )}
                        >
                          {formatCurrency(e.amount)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Saldo: {formatCurrency(e.balanceAfter)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
