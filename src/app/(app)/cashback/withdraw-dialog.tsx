"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { HandCoins } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { requestWithdrawAction } from "@/lib/actions/withdraw";
import { ACTION_ERROR_MESSAGES } from "@/lib/actions/errors";
import { formatCurrency } from "@/lib/format";
import type { AuthorBalance } from "@/modules/authors/authors.types";
import {
  withdrawRequestSchema,
  type WithdrawRequestData,
} from "@/modules/cashback/cashback.schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Autores com saldo > 0 podem receber resgate. */
export function WithdrawDialog({
  authors,
  defaultAuthorId,
}: {
  authors: AuthorBalance[];
  defaultAuthorId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const eligible = useMemo(() => authors.filter((a) => a.currentBalance > 0), [authors]);

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WithdrawRequestData>({
    resolver: zodResolver(withdrawRequestSchema),
    defaultValues: { authorId: defaultAuthorId ?? "", amount: undefined, notes: "" },
  });

  const selectedId = watch("authorId");
  const selected = eligible.find((a) => a.authorId === selectedId);

  async function onSubmit(data: WithdrawRequestData) {
    const result = await requestWithdrawAction(data);
    if (result.ok) {
      toast.success("Resgate solicitado com sucesso.");
      reset({ authorId: "", amount: undefined, notes: "" });
      setOpen(false);
      router.refresh();
    } else {
      toast.error(ACTION_ERROR_MESSAGES[result.error.code]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <HandCoins className="h-4 w-4" />
          Solicitar resgate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar resgate</DialogTitle>
          <DialogDescription>
            Cria um lançamento negativo com status &quot;Resgate Solicitado&quot;. O valor fica
            bloqueado até a aprovação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="authorId">Autor</Label>
            <Controller
              control={control}
              name="authorId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="authorId" aria-invalid={!!errors.authorId}>
                    <SelectValue placeholder="Selecione um autor com saldo" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligible.length === 0 ? (
                      <div className="text-muted-foreground px-2 py-1.5 text-sm">
                        Nenhum autor com saldo disponível.
                      </div>
                    ) : (
                      eligible.map((a) => (
                        <SelectItem key={a.authorId} value={a.authorId}>
                          {a.name} ({a.coupon}) — {formatCurrency(a.currentBalance)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.authorId && (
              <p className="text-destructive text-xs">{errors.authorId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              aria-invalid={!!errors.amount}
              {...register("amount", { valueAsNumber: true })}
            />
            {selected && (
              <p className="text-muted-foreground text-xs">
                Saldo disponível: {formatCurrency(selected.currentBalance)}
              </p>
            )}
            {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observação (opcional)</Label>
            <Input id="notes" placeholder="Ex.: chave PIX, motivo…" {...register("notes")} />
            {errors.notes && <p className="text-destructive text-xs">{errors.notes.message}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={eligible.length === 0}>
              Solicitar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
