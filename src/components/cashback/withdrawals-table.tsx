"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { BadgeCheck, Banknote, Download, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ACTION_ERROR_MESSAGES } from "@/lib/actions/errors";
import {
  approveWithdrawAction,
  cancelWithdrawAction,
  payWithdrawAction,
} from "@/lib/actions/withdraw";
import type { ActionResult } from "@/lib/actions/errors";
import { exportToCsv } from "@/lib/export-csv";
import { formatCpfCnpj, formatDateTime } from "@/lib/format";
import type { LedgerEntry } from "@/modules/cashback/cashback.types";
import { AuthorHistoryDrawer } from "@/app/(app)/cashback/author-history-drawer";
import { ConfirmButton } from "@/components/confirm-button";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const num = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface DrawerAuthor {
  id: string;
  name: string;
  coupon: string;
  cpfCnpj: string | null;
}

export function WithdrawalsTable({
  entries,
  variant,
}: {
  entries: LedgerEntry[];
  variant: "administration" | "payments";
}) {
  const router = useRouter();
  const [drawerAuthor, setDrawerAuthor] = useState<DrawerAuthor | null>(null);

  async function run(result: Promise<ActionResult<{ id: string }>>, successMsg: string) {
    const r = await result;
    if (r.ok) {
      toast.success(successMsg);
      router.refresh();
    } else {
      toast.error(ACTION_ERROR_MESSAGES[r.error.code]);
    }
  }

  const columns: ColumnDef<LedgerEntry, unknown>[] = [
    {
      accessorKey: "occurredAt",
      header: "Solicitado em",
      cell: (info) => formatDateTime(info.getValue<string>()),
    },
    { accessorKey: "authorName", header: "Autor" },
    {
      accessorKey: "coupon",
      header: "Cupom",
      cell: (info) => <span className="font-medium">{info.getValue<string>()}</span>,
    },
    {
      id: "cpfCnpj",
      accessorFn: (r) => r.cpfCnpj ?? "",
      header: "CPF/CNPJ",
      cell: ({ row }) => formatCpfCnpj(row.original.cpfCnpj),
    },
    {
      id: "value",
      accessorFn: (r) => Math.abs(r.amount),
      header: "Valor",
      cell: (info) => <span className="font-medium">R$ {num(info.getValue<number>())}</span>,
    },
    {
      accessorKey: "notes",
      header: "Observação",
      enableSorting: false,
      cell: (info) => info.getValue<string | null>() ?? "—",
    },
    {
      id: "actions",
      header: "Ações",
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="flex justify-end gap-2" onClick={(ev) => ev.stopPropagation()}>
            {variant === "administration" ? (
              <ConfirmButton
                trigger={
                  <Button size="sm">
                    <BadgeCheck className="h-4 w-4" />
                    Aprovar
                  </Button>
                }
                title="Aprovar resgate?"
                description={`Liberar o resgate de R$ ${num(Math.abs(e.amount))} de ${e.authorName}. O pagamento ainda precisará ser confirmado.`}
                confirmLabel="Aprovar"
                onConfirm={() => run(approveWithdrawAction(e.id), "Resgate liberado.")}
              />
            ) : (
              <ConfirmButton
                trigger={
                  <Button size="sm">
                    <Banknote className="h-4 w-4" />
                    Marcar como pago
                  </Button>
                }
                title="Confirmar pagamento?"
                description={`Confirmar o pagamento de R$ ${num(Math.abs(e.amount))} para ${e.authorName}. Esta ação registra o resgate como pago.`}
                confirmLabel="Confirmar pagamento"
                onConfirm={() => run(payWithdrawAction(e.id), "Pagamento confirmado.")}
              />
            )}
            <ConfirmButton
              trigger={
                <Button size="sm" variant="outline">
                  <XCircle className="h-4 w-4" />
                  Cancelar
                </Button>
              }
              title="Cancelar resgate?"
              description={`Cancelar o resgate de R$ ${num(Math.abs(e.amount))} de ${e.authorName}. O valor volta para o saldo do autor.`}
              confirmLabel="Cancelar resgate"
              confirmVariant="destructive"
              onConfirm={() => run(cancelWithdrawAction(e.id), "Resgate cancelado.")}
            />
          </div>
        );
      },
    },
  ];

  function handleExport() {
    const headers = ["Solicitado em", "Autor", "Cupom", "CPF/CNPJ", "Valor", "Observação"];
    const rows = entries.map((e) => [
      formatDateTime(e.occurredAt),
      e.authorName,
      e.coupon,
      formatCpfCnpj(e.cpfCnpj),
      num(Math.abs(e.amount)),
      e.notes ?? "",
    ]);
    exportToCsv(
      variant === "administration" ? "resgates-solicitados" : "resgates-a-pagar",
      headers,
      rows,
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={entries}
        searchPlaceholder="Buscar por autor, cupom…"
        onRowClick={(row) =>
          setDrawerAuthor({
            id: row.authorId,
            name: row.authorName,
            coupon: row.coupon,
            cpfCnpj: row.cpfCnpj,
          })
        }
        emptyMessage={
          variant === "administration"
            ? "Nenhum resgate aguardando aprovação."
            : "Nenhum resgate liberado aguardando pagamento."
        }
        toolbar={
          <Button variant="outline" onClick={handleExport} disabled={entries.length === 0}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        }
      />
      <AuthorHistoryDrawer author={drawerAuthor} onClose={() => setDrawerAuthor(null)} />
    </>
  );
}
