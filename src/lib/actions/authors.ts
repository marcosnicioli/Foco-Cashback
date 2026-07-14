"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/assert-permission";
import { fail, mapPostgresError, ok, type ActionResult } from "@/lib/actions/errors";
import { authorFormSchema, type AuthorFormData } from "@/modules/authors/authors.schema";

const idSchema = z.string().uuid();

export async function createAuthorAction(
  input: AuthorFormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = authorFormSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");

  const denied = await assertPermission<{ id: string }>("authors.write");
  if (denied) return denied;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("forbidden");

  const { data, error } = await supabase
    .from("authors")
    .insert({
      name: parsed.data.name,
      coupon: parsed.data.coupon,
      cpf_cnpj: parsed.data.cpfCnpj || null,
      email: parsed.data.email || null,
      created_by: user.id,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    console.error(`[authors.create] falhou: ${error?.message}`);
    return { ok: false, error: mapPostgresError(error) };
  }

  revalidatePath("/authors");
  revalidatePath("/cashback");
  return ok({ id: (data as { id: string }).id });
}

export async function updateAuthorAction(
  id: string,
  input: AuthorFormData,
): Promise<ActionResult<{ id: string }>> {
  if (!idSchema.safeParse(id).success) return fail("invalidInput");

  const parsed = authorFormSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");

  const denied = await assertPermission<{ id: string }>("authors.write");
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("authors")
    .update({
      name: parsed.data.name,
      coupon: parsed.data.coupon,
      cpf_cnpj: parsed.data.cpfCnpj || null,
      email: parsed.data.email || null,
    } as never)
    .eq("id", id);

  if (error) {
    console.error(`[authors.update] falhou (${id}): ${error.message}`);
    return { ok: false, error: mapPostgresError(error) };
  }

  revalidatePath("/authors");
  revalidatePath("/cashback");
  return ok({ id });
}
