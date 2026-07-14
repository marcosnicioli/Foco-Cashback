"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { useState } from "react";
import { exportToCsv } from "@/lib/export-csv";
import { formatCpfCnpj, formatDate } from "@/lib/format";
import type { AuthorBalance } from "@/modules/authors/authors.types";
import { type LedgerEntry, situationLabel } from "@/modules/cashback/cashback.types";
import { StatusBadge } from "@/components/cashback/status-badge";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuthorHistoryDrawer } from "./author-history-drawer";
import { WithdrawDialog } from "./withdraw-dialog";

/** Número pt-BR sem símbolo, para exportação (Excel lê como número). */
const num = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface DrawerAuthor {
  id: string;
  name: string;
  coupon: string;
  cpfCnpj: string | null;
}

export function CashbackClient({
  entries,
  balances,
  canRequest,
}: {
  entries: LedgerEntry[];
  balances: AuthorBalance[];
  canRequest: boolean;
}) {
  const [drawerAuthor, setDrawerAuthor] = useState<DrawerAuthor | null>(null);

  const columns: ColumnDef<LedgerEntry, unknown>[] = [
    {
      accessorKey: "coupon",
      header: "Cupom",
      cell: (info) => <span className="font-medium">{info.getValue<string>()}</span>,
    },
    {
      accessorKey: "orderNumber",
      header: "Pedido",
      cell: (info) => info.getValue<string | null>() ?? "—",
    },
    {
      accessorKey: "occurredAt",
      header: "Data",
      cell: (info) => formatDate(info.getValue<string>()),
    },
    {
      accessorKey: "balanceBefore",
      header: "Saldo Anterior",
      cell: (info) => `R$ ${num(info.getValue<number>())}`,
    },
    {
      accessorKey: "amount",
      header: "Cashback",
      cell: (info) => {
        const v = info.getValue<number>();
        return (
          <span className={cn("font-medium", v < 0 ? "text-destructive" : "text-success")}>
            R$ {num(v)}
          </span>
        );
      },
    },
    {
      accessorKey: "balanceAfter",
      header: "Saldo Atual",
      cell: (info) => `R$ ${num(info.getValue<number>())}`,
    },
    {
      id: "withdrawAmount",
      accessorFn: (r) => (r.entryType === "withdrawal" ? Math.abs(r.amount) : null),
      header: "Valor em Resgate",
      cell: (info) => {
        const v = info.getValue<number | null>();
        return v == null ? "—" : `R$ ${num(v)}`;
      },
    },
    {
      id: "situation",
      accessorFn: (r) => situationLabel(r),
      header: "Situação",
      enableSorting: false,
      cell: ({ row }) => (
        <StatusBadge
          entryType={row.original.entryType}
          withdrawalStatus={row.original.withdrawalStatus}
        />
      ),
    },
    { accessorKey: "authorName", header: "Autor" },
    {
      id: "cpfCnpj",
      accessorFn: (r) => r.cpfCnpj ?? "",
      header: "CPF/CNPJ",
      cell: ({ row }) => formatCpfCnpj(row.original.cpfCnpj),
    },
  ];

  function handleExport() {
    const headers = [
      "Cupom",
      "Pedido",
      "Data",
      "Saldo Anterior",
      "Cashback",
      "Saldo Atual",
      "Valor em Resgate",
      "Situação",
      "Autor",
      "CPF/CNPJ",
    ];
    const rows = entries.map((e) => [
      e.coupon,
      e.orderNumber ?? "",
      formatDate(e.occurredAt),
      num(e.balanceBefore),
      num(e.amount),
      num(e.balanceAfter),
      e.entryType === "withdrawal" ? num(Math.abs(e.amount)) : "",
      situationLabel(e),
      e.authorName,
      formatCpfCnpj(e.cpfCnpj),
    ]);
    exportToCsv("cashback", headers, rows);
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={entries}
        searchPlaceholder="Buscar por cupom, autor, pedido…"
        onRowClick={(row) =>
          setDrawerAuthor({
            id: row.authorId,
            name: row.authorName,
            coupon: row.coupon,
            cpfCnpj: row.cpfCnpj,
          })
        }
        emptyMessage="Nenhum lançamento encontrado com os filtros atuais."
        toolbar={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={entries.length === 0}>
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            {canRequest && <WithdrawDialog authors={balances} />}
          </div>
        }
      />

      <AuthorHistoryDrawer author={drawerAuthor} onClose={() => setDrawerAuthor(null)} />
    </>
  );
}
