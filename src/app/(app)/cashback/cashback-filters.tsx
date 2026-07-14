"use client";

import { Filter, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CashbackFilter } from "@/modules/cashback/cashback.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "cashback_received", label: "Cashback Recebido" },
  { value: "requested", label: "Resgate Solicitado" },
  { value: "approved", label: "Resgate Liberado" },
  { value: "paid", label: "Resgate Pago" },
  { value: "cancelled", label: "Resgate Cancelado" },
] as const;

export function CashbackFilters({ defaults }: { defaults: CashbackFilter }) {
  const router = useRouter();
  const [values, setValues] = useState<CashbackFilter>(defaults);

  function set<K extends keyof CashbackFilter>(key: K, value: CashbackFilter[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function apply() {
    const params = new URLSearchParams();
    if (values.coupon?.trim()) params.set("coupon", values.coupon.trim());
    if (values.author?.trim()) params.set("author", values.author.trim());
    if (values.cpfCnpj?.trim()) params.set("cpfCnpj", values.cpfCnpj.trim());
    if (values.orderNumber?.trim()) params.set("orderNumber", values.orderNumber.trim());
    if (values.status) params.set("status", values.status);
    if (values.from) params.set("from", values.from);
    if (values.to) params.set("to", values.to);
    router.push(`/cashback?${params.toString()}`);
  }

  function clear() {
    setValues({});
    router.push("/cashback");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="border-border bg-card grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="f-coupon">Cupom</Label>
        <Input
          id="f-coupon"
          value={values.coupon ?? ""}
          onChange={(e) => set("coupon", e.target.value)}
          placeholder="LETICIA20"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-author">Autor</Label>
        <Input
          id="f-author"
          value={values.author ?? ""}
          onChange={(e) => set("author", e.target.value)}
          placeholder="Nome do autor"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-cpf">CPF/CNPJ</Label>
        <Input
          id="f-cpf"
          value={values.cpfCnpj ?? ""}
          onChange={(e) => set("cpfCnpj", e.target.value)}
          placeholder="000.000.000-00"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-order">Pedido</Label>
        <Input
          id="f-order"
          value={values.orderNumber ?? ""}
          onChange={(e) => set("orderNumber", e.target.value)}
          placeholder="Nº do pedido"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-status">Situação</Label>
        <Select
          value={values.status ?? "all"}
          onValueChange={(v) =>
            set("status", v === "all" ? undefined : (v as CashbackFilter["status"]))
          }
        >
          <SelectTrigger id="f-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-from">De</Label>
        <Input
          id="f-from"
          type="date"
          value={values.from ?? ""}
          onChange={(e) => set("from", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-to">Até</Label>
        <Input
          id="f-to"
          type="date"
          value={values.to ?? ""}
          onChange={(e) => set("to", e.target.value)}
        />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" className="flex-1">
          <Filter className="h-4 w-4" />
          Filtrar
        </Button>
        <Button type="button" variant="outline" onClick={clear} aria-label="Limpar filtros">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
