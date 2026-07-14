import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Author, AuthorBalance } from "@/modules/authors/authors.types";

/**
 * SERVICE = leitura (server-only). Retorna o dado ou LANÇA erro; nunca escreve.
 * Veja docs/SERVICE-ACTION-PATTERN.md e o módulo de referência `profile`.
 */

type AuthorRow = {
  id: string;
  name: string;
  coupon: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  created_at: string;
};

function toAuthor(r: AuthorRow): Author {
  return {
    id: r.id,
    name: r.name,
    coupon: r.coupon ?? "", // coluna é nullable no banco; domínio usa string
    cpfCnpj: r.cpf_cnpj,
    email: r.email,
    createdAt: r.created_at,
  };
}

/**
 * Remove caracteres que quebram o parser do `.or()` do PostgREST (vírgula,
 * parênteses, aspas) para o termo de busca ir seguro dentro da expressão.
 */
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()"*\\]/g, " ").trim();
}

export async function listAuthors(): Promise<Author[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("authors")
    .select("id, name, coupon, cpf_cnpj, email, created_at")
    .order("name")
    .returns<AuthorRow[]>();

  if (error) {
    console.error(`[authors] listAuthors falhou: ${error.message}`);
    throw error;
  }
  return (data ?? []).map(toAuthor);
}

export async function getAuthorById(id: string): Promise<Author | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("authors")
    .select("id, name, coupon, cpf_cnpj, email, created_at")
    .eq("id", id)
    .returns<AuthorRow[]>()
    .maybeSingle();

  if (error) {
    console.error(`[authors] getAuthorById falhou: ${error.message}`);
    throw error;
  }
  return data ? toAuthor(data) : null;
}

type BalanceRow = {
  author_id: string;
  name: string;
  coupon: string | null;
  cpf_cnpj: string | null;
  total_credited: number;
  total_paid: number;
  blocked_amount: number;
  current_balance: number;
};

function toBalance(r: BalanceRow): AuthorBalance {
  return {
    authorId: r.author_id,
    name: r.name,
    coupon: r.coupon ?? "",
    cpfCnpj: r.cpf_cnpj,
    totalCredited: Number(r.total_credited),
    totalPaid: Number(r.total_paid),
    blockedAmount: Number(r.blocked_amount),
    currentBalance: Number(r.current_balance),
  };
}

/** Saldos de todos os autores (view `author_balances`), com busca opcional. */
export async function listAuthorBalances(search?: string): Promise<AuthorBalance[]> {
  const supabase = await createClient();
  let query = supabase
    .from("author_balances")
    .select(
      "author_id, name, coupon, cpf_cnpj, total_credited, total_paid, blocked_amount, current_balance",
    );

  const safe = search ? sanitizeSearchTerm(search) : "";
  if (safe) {
    const term = `%${safe}%`;
    query = query.or(`name.ilike.${term},coupon.ilike.${term},cpf_cnpj.ilike.${term}`);
  }

  const { data, error } = await query.order("name").returns<BalanceRow[]>();

  if (error) {
    console.error(`[authors] listAuthorBalances falhou: ${error.message}`);
    throw error;
  }
  return (data ?? []).map(toBalance);
}

export async function getAuthorBalance(authorId: string): Promise<AuthorBalance | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("author_balances")
    .select(
      "author_id, name, coupon, cpf_cnpj, total_credited, total_paid, blocked_amount, current_balance",
    )
    .eq("author_id", authorId)
    .returns<BalanceRow[]>()
    .maybeSingle();

  if (error) {
    console.error(`[authors] getAuthorBalance falhou: ${error.message}`);
    throw error;
  }
  return data ? toBalance(data) : null;
}
