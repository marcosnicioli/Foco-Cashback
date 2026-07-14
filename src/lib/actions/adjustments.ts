"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { fail, mapPostgresError, ok, type ActionResult } from "@/lib/actions/errors";
import { adjustmentSchema, type AdjustmentData } from "@/modules/cashback/cashback.schema";

/**
 * Ajuste manual de saldo (só admin). Crédito soma; débito subtrai (sem deixar o
 * saldo negativo — checado aqui e pela trava do banco). Todo ajuste fica no
 * histórico com uma observação obrigatória (motivo).
 */
export async function createAdjustmentAction(
  input: AdjustmentData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");

  const denied = await assertPermission<{ id: string }>("ledger.adjust");
  if (denied) return denied;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("forbidden");

  const isCredit = parsed.data.direction === "credit";

  // Débito não pode ultrapassar o saldo disponível.
  if (!isCredit) {
    const { data: balance, error: balErr } = await supabase.rpc(
      "author_available_balance",
      // `as never`: workaround do descompasso de generics ssr/supabase-js (ver CONVENTIONS.md).
      { p_author_id: parsed.data.authorId } as never,
    );
    if (balErr) {
      console.error(`[adjustment] cálculo de saldo falhou: ${balErr.message}`);
      return fail("unexpected");
    }
    if (Number(balance ?? 0) < parsed.data.amount) return fail("insufficientBalance");
  }

  const { data, error } = await supabase
    .from("cashback_ledger")
    .insert({
      author_id: parsed.data.authorId,
      entry_type: isCredit ? "adjustment_credit" : "adjustment_debit",
      amount: isCredit ? parsed.data.amount : -parsed.data.amount,
      notes: parsed.data.notes,
      created_by: user.id,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    console.error(`[adjustment] falhou: ${error?.message}`);
    return { ok: false, error: mapPostgresError(error) };
  }

  revalidatePath("/cashback");
  revalidatePath("/dashboard");
  return ok({ id: (data as { id: string }).id });
}
