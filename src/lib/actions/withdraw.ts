"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { fail, mapPostgresError, ok, type ActionResult } from "@/lib/actions/errors";
import {
  withdrawRequestSchema,
  type WithdrawRequestData,
} from "@/modules/cashback/cashback.schema";
import { canWithdraw } from "@/lib/cashback/ledger-rules";

/**
 * ACTIONS de resgate — SEMPRE retornam `ActionResult<T>`, NUNCA lançam.
 * Ordem: validar → autenticar/autorizar → checar regra → escrever → mapear erro
 * → revalidar. Veja docs/SERVICE-ACTION-PATTERN.md.
 */

const idSchema = z.string().uuid();

/** Revalida todas as telas afetadas por uma mudança de resgate. */
function revalidateWithdrawRoutes() {
  revalidatePath("/cashback");
  revalidatePath("/withdrawals");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
}

/**
 * Solicitar resgate: cria um lançamento negativo com status `requested`.
 * Regras: valor > 0 (schema) e valor ≤ saldo disponível (aqui + trava no banco).
 */
export async function requestWithdrawAction(
  input: WithdrawRequestData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = withdrawRequestSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");

  const denied = await assertPermission<{ id: string }>("withdraw.request");
  if (denied) return denied;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("forbidden");

  // Regra de negócio: não pode ultrapassar o saldo disponível.
  const { data: balance, error: balErr } = await supabase.rpc(
    "author_available_balance",
    // `as never`: workaround do descompasso de generics ssr/supabase-js (ver CONVENTIONS.md).
    { p_author_id: parsed.data.authorId } as never,
  );
  if (balErr) {
    console.error(`[withdraw.request] cálculo de saldo falhou: ${balErr.message}`);
    return fail("unexpected");
  }
  // Mesma regra do banco (enforce_non_negative_balance): não pode zerar abaixo de 0.
  if (!canWithdraw(Number(balance ?? 0), parsed.data.amount)) return fail("insufficientBalance");

  const { data, error } = await supabase
    .from("cashback_ledger")
    .insert({
      author_id: parsed.data.authorId,
      entry_type: "withdrawal",
      amount: -parsed.data.amount,
      withdrawal_status: "requested",
      notes: parsed.data.notes || null,
      created_by: user.id,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    console.error(`[withdraw.request] falhou: ${error?.message}`);
    return { ok: false, error: mapPostgresError(error) };
  }

  revalidateWithdrawRoutes();
  return ok({ id: (data as { id: string }).id });
}

/** Aprovar resgate: `requested` → `approved`. */
export async function approveWithdrawAction(id: string): Promise<ActionResult<{ id: string }>> {
  if (!idSchema.safeParse(id).success) return fail("invalidInput");

  const denied = await assertPermission<{ id: string }>("withdraw.approve");
  if (denied) return denied;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("forbidden");

  const { data, error } = await supabase
    .from("cashback_ledger")
    .update({
      withdrawal_status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    } as never)
    .eq("id", id)
    .eq("entry_type", "withdrawal")
    .eq("withdrawal_status", "requested")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[withdraw.approve] falhou (${id}): ${error.message}`);
    return { ok: false, error: mapPostgresError(error) };
  }
  if (!data) return fail("conflict"); // não existe ou não estava "solicitado"

  revalidateWithdrawRoutes();
  return ok({ id });
}

/** Marcar como pago: `approved` → `paid`. */
export async function payWithdrawAction(id: string): Promise<ActionResult<{ id: string }>> {
  if (!idSchema.safeParse(id).success) return fail("invalidInput");

  const denied = await assertPermission<{ id: string }>("withdraw.pay");
  if (denied) return denied;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("forbidden");

  const { data, error } = await supabase
    .from("cashback_ledger")
    .update({
      withdrawal_status: "paid",
      paid_at: new Date().toISOString(),
      paid_by: user.id,
    } as never)
    .eq("id", id)
    .eq("entry_type", "withdrawal")
    .eq("withdrawal_status", "approved")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[withdraw.pay] falhou (${id}): ${error.message}`);
    return { ok: false, error: mapPostgresError(error) };
  }
  if (!data) return fail("conflict"); // não existe ou não estava "liberado"

  revalidateWithdrawRoutes();
  return ok({ id });
}

/** Cancelar resgate (devolve o valor ao saldo): `requested`/`approved` → `cancelled`. */
export async function cancelWithdrawAction(id: string): Promise<ActionResult<{ id: string }>> {
  if (!idSchema.safeParse(id).success) return fail("invalidInput");

  const denied = await assertPermission<{ id: string }>("withdraw.cancel");
  if (denied) return denied;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("forbidden");

  const { data, error } = await supabase
    .from("cashback_ledger")
    .update({
      withdrawal_status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
    } as never)
    .eq("id", id)
    .eq("entry_type", "withdrawal")
    .in("withdrawal_status", ["requested", "approved"])
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[withdraw.cancel] falhou (${id}): ${error.message}`);
    return { ok: false, error: mapPostgresError(error) };
  }
  if (!data) return fail("conflict"); // não existe ou já pago/cancelado

  revalidateWithdrawRoutes();
  return ok({ id });
}
