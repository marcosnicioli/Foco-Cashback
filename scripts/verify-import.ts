/**
 * Verificação pós-importação (somente leitura). Conta linhas do ledger e soma
 * os saldos da view author_balances para conferir com o resumo do importador.
 *
 *   corepack pnpm tsx scripts/verify-import.ts
 *
 * Usa a service_role (ignora RLS) — roda SÓ no servidor.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path: string) {
  try {
    const txt = readFileSync(path, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1] && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
}
loadEnv(".env.local");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const ledger = () => supabase.from("cashback_ledger").select("*", { count: "exact", head: true });

  const { count: authors } = await supabase
    .from("authors")
    .select("*", { count: "exact", head: true });

  const { count: cashback } = await ledger().eq("entry_type", "cashback_received");
  const { count: paid } = await ledger()
    .eq("entry_type", "withdrawal")
    .eq("withdrawal_status", "paid");
  const { count: requested } = await ledger()
    .eq("entry_type", "withdrawal")
    .eq("withdrawal_status", "requested");
  const { count: approved } = await ledger()
    .eq("entry_type", "withdrawal")
    .eq("withdrawal_status", "approved");

  // Soma dos saldos via view (paginando).
  let totalBalance = 0;
  let totalCredited = 0;
  let totalPaid = 0;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("author_balances")
      .select("current_balance, total_credited, total_paid")
      .range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as {
      current_balance: number;
      total_credited: number;
      total_paid: number;
    }[]) {
      totalBalance += Number(r.current_balance);
      totalCredited += Number(r.total_credited);
      totalPaid += Number(r.total_paid);
    }
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  const brl = (n: number) => `R$ ${n.toFixed(2)}`;
  console.log("\n== Verificação da importação (estado real no banco) ==");
  console.log(`Autores:                      ${authors}`);
  console.log(`Cashback recebido (linhas):   ${cashback}`);
  console.log(`Resgates pagos (linhas):      ${paid}`);
  console.log(`Resgates solicitados:         ${requested}`);
  console.log(`Resgates liberados:           ${approved}`);
  console.log(`Total creditado:              ${brl(totalCredited)}`);
  console.log(`Total pago:                   ${brl(totalPaid)}`);
  console.log(`Saldo disponível (Σ):         ${brl(totalBalance)}`);
  console.log("");
}

main().catch((e) => {
  console.error("✗ Erro:", e);
  process.exit(1);
});
