"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Download, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { exportToCsv } from "@/lib/export-csv";
import { formatCpfCnpj } from "@/lib/format";
import { AuthorHistoryDrawer } from "@/app/(app)/cashback/author-history-drawer";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { AuthorFormDialog } from "./author-form-dialog";

const num = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface AuthorRow {
  id: string;
  name: string;
  coupon: string;
  cpfCnpj: string | null;
  email: string | null;
  currentBalance: number;
  totalPaid: number;
  blockedAmount: number;
}

interface DrawerAuthor {
  id: string;
  name: string;
  coupon: string;
  cpfCnpj: string | null;
}

export function AuthorsClient({ authors, canWrite }: { authors: AuthorRow[]; canWrite: boolean }) {
  const [drawerAuthor, setDrawerAuthor] = useState<DrawerAuthor | null>(null);

  const columns: ColumnDef<AuthorRow, unknown>[] = [
    {
      accessorKey: "name",
      header: "Autor",
      cell: (info) => <span className="font-medium">{info.getValue<string>()}</span>,
    },
    { accessorKey: "coupon", header: "Cupom" },
    {
      id: "cpfCnpj",
      accessorFn: (r) => r.cpfCnpj ?? "",
      header: "CPF/CNPJ",
      cell: ({ row }) => formatCpfCnpj(row.original.cpfCnpj),
    },
    {
      accessorKey: "currentBalance",
      header: "Saldo",
      cell: (info) => <span className="font-medium">R$ {num(info.getValue<number>())}</span>,
    },
    {
      accessorKey: "blockedAmount",
      header: "Em resgate",
      cell: (info) => `R$ ${num(info.getValue<number>())}`,
    },
    {
      accessorKey: "totalPaid",
      header: "Total pago",
      cell: (info) => `R$ ${num(info.getValue<number>())}`,
    },
    {
      id: "actions",
      header: "Ações",
      enableSorting: false,
      cell: ({ row }) =>
        canWrite ? (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <AuthorFormDialog
              author={row.original}
              trigger={
                <Button size="sm" variant="outline">
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
              }
            />
          </div>
        ) : null,
    },
  ];

  function handleExport() {
    const headers = ["Autor", "Cupom", "CPF/CNPJ", "Saldo", "Em resgate", "Total pago"];
    const rows = authors.map((a) => [
      a.name,
      a.coupon,
      formatCpfCnpj(a.cpfCnpj),
      num(a.currentBalance),
      num(a.blockedAmount),
      num(a.totalPaid),
    ]);
    exportToCsv("autores", headers, rows);
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={authors}
        searchPlaceholder="Buscar por nome ou cupom…"
        onRowClick={(row) =>
          setDrawerAuthor({
            id: row.id,
            name: row.name,
            coupon: row.coupon,
            cpfCnpj: row.cpfCnpj,
          })
        }
        emptyMessage="Nenhum autor cadastrado."
        toolbar={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={authors.length === 0}>
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            {canWrite && (
              <AuthorFormDialog
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" />
                    Novo autor
                  </Button>
                }
              />
            )}
          </div>
        }
      />
      <AuthorHistoryDrawer author={drawerAuthor} onClose={() => setDrawerAuthor(null)} />
    </>
  );
}
