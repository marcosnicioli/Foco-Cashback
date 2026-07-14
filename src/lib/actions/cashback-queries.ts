"use server";

import { z } from "zod";
import { getAuthorHistory } from "@/lib/services/cashback";
import { hasPermission } from "@/lib/rbac/rbac.config";
import { getCurrentUserRole } from "@/lib/auth/current-user";
import type { LedgerEntry } from "@/modules/cashback/cashback.types";

const idSchema = z.string().uuid();

/**
 * Leitura sob demanda a partir de um client component (o Drawer de histórico).
 * Defesa em profundidade: valida o id, checa a permissão no app (além da RLS) e,
 * em caso de erro, devolve lista vazia (a UI trata).
 */
export async function fetchAuthorHistory(authorId: string): Promise<LedgerEntry[]> {
  if (!idSchema.safeParse(authorId).success) return [];
  if (!hasPermission(await getCurrentUserRole(), "cashback.read")) return [];
  try {
    return await getAuthorHistory(authorId);
  } catch (error) {
    console.error(`[cashback-queries] fetchAuthorHistory falhou: ${(error as Error).message}`);
    return [];
  }
}
