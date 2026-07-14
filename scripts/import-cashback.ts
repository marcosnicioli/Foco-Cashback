/**
 * Importador do histórico de cashback (CSV do sistema anterior) para o Supabase.
 *
 * Uso (na raiz do projeto):
 *   corepack pnpm import:cashback -- --dry-run          # só valida e mostra o resumo (NÃO grava)
 *   corepack pnpm import:cashback                        # importa de verdade
 *   corepack pnpm import:cashback -- --file data/x.csv   # arquivo alternativo
 *   corepack pnpm import:cashback -- --truncate          # limpa authors+ledger antes (recomeço limpo)
 *
 * Regras de importação (decididas com o cliente):
 *  - O AUTOR é identificado por `id_usuario` (external_id). O cupom é do pedido.
 *  - Cada linha COM `numeropedido` é um cashback recebido; valor = saldo − saldoanterior.
 *  - Resgates JÁ PAGOS são resumidos em 1 lançamento "pago" por autor (soma dos
 *    cashbacks marcados "Resgate Pago"), preservando o histórico de ganhos.
 *  - O resgate PENDENTE atual de cada autor vem da coluna `valorresgatependente`
 *    da linha mais recente, importado como 1 lançamento (solicitado/liberado).
 *  - Nomes com acentuação quebrada (mojibake) são corrigidos.
 *  - Duplicidades de (autor, pedido) são ignoradas.
 *
 * A lógica pura (parsing, agregação, resumo) fica em src/lib/cashback/import-core.ts
 * (testada em import-core.test.ts). Este script cuida só do arquivo e do banco.
 *
 * Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.
 * A service_role ignora RLS — este script roda SÓ no servidor, nunca no browser.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  aggregate,
  parseRows,
  round2,
  summarize,
  toIso,
  type AuthorAgg,
  type CsvRow,
} from "../src/lib/cashback/import-core";

// ---------------------------------------------------------------------------
// Carrega variáveis de ambiente do .env.local (sem depender de libs externas)
// ---------------------------------------------------------------------------
function loadEnv(path: string) {
  try {
    const txt = readFileSync(path, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1] && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    /* arquivo ausente: usa o que já estiver no ambiente */
  }
}
loadEnv(".env.local");

// ---------------------------------------------------------------------------
// Argumentos de linha de comando
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const TRUNCATE = args.includes("--truncate");
const fileIdx = args.indexOf("--file");
const CSV_PATH = fileIdx >= 0 && args[fileIdx + 1] ? args[fileIdx + 1]! : "data/cashback.csv";
const LOG_PATH = "data/import-log.txt";
const BATCH = 500;

// Avisos/anomalias acumulados para o log em arquivo.
const log: string[] = [];
const warn = (msg: string) => log.push(msg);

// ---------------------------------------------------------------------------
// Leitura do arquivo (I/O) — o parsing em si vem de import-core.
// ---------------------------------------------------------------------------
function readCsv(path: string): CsvRow[] {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(`\n✗ Não encontrei o arquivo "${path}".`);
    console.error(`  Salve o CSV exportado ali (ou use: --file caminho/do/arquivo.csv).\n`);
    process.exit(1);
  }
  try {
    return parseRows(raw, warn);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Gravação no Supabase
// ---------------------------------------------------------------------------
async function insertInBatches<T>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(chunk as never);
    if (error) {
      // tenta linha a linha para não perder o lote inteiro por causa de 1 registro
      for (const row of chunk) {
        const { error: e2 } = await supabase.from(table).insert(row as never);
        if (e2) warn(`Falha ao inserir em ${table}: ${e2.message}`);
        else inserted++;
      }
    } else {
      inserted += chunk.length;
    }
  }
  return inserted;
}

async function runImport(authors: Map<string, AuthorAgg>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "✗ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.",
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  if (TRUNCATE) {
    console.log("Limpando dados existentes (authors + ledger)…");
    await supabase
      .from("cashback_ledger")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("authors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }

  // 1) Autores
  const authorRows = [...authors.values()].map((a) => ({
    external_id: a.externalId,
    name: a.name,
    coupon: a.coupon,
  }));
  console.log(`Inserindo ${authorRows.length} autores…`);
  await insertInBatches(supabase, "authors", authorRows);

  // Mapeia external_id → id (uuid)
  const idByExternal = new Map<string, string>();
  {
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("authors")
        .select("id, external_id")
        .not("external_id", "is", null)
        .range(from, from + 999);
      if (error) {
        console.error(`✗ Erro ao ler autores: ${error.message}`);
        process.exit(1);
      }
      for (const row of (data ?? []) as { id: string; external_id: string }[]) {
        idByExternal.set(row.external_id, row.id);
      }
      if (!data || data.length < 1000) break;
      from += 1000;
    }
  }

  // 2) Cashback (todos os pedidos, positivos → sem risco de saldo negativo)
  const cashbackRows: Record<string, unknown>[] = [];
  for (const a of authors.values()) {
    const authorId = idByExternal.get(a.externalId);
    if (!authorId) continue;
    for (const [order, c] of a.cashback) {
      cashbackRows.push({
        author_id: authorId,
        entry_type: "cashback_received",
        order_number: order,
        coupon: c.coupon || null,
        amount: c.amount,
        occurred_at: toIso(c.date),
        notes: c.paid ? "Importado (já resgatado no sistema anterior)" : "Importado",
      });
    }
  }
  console.log(`Inserindo ${cashbackRows.length} lançamentos de cashback…`);
  await insertInBatches(supabase, "cashback_ledger", cashbackRows);

  // 3) Resgates JÁ PAGOS resumidos (1 por autor) — inseridos após o cashback estar gravado
  const paidRows: Record<string, unknown>[] = [];
  for (const a of authors.values()) {
    const authorId = idByExternal.get(a.externalId);
    if (!authorId) continue;
    // Valor pago é o total no nível da linha (import-core); a data é a do
    // crédito pago mais recente, só para carimbar occurred_at/paid_at.
    let lastPaidDate = "";
    for (const c of a.cashback.values()) {
      if (c.paid && c.date > lastPaidDate) lastPaidDate = c.date;
    }
    const paidTotal = round2(a.paidTotal);
    if (paidTotal > 0) {
      paidRows.push({
        author_id: authorId,
        entry_type: "withdrawal",
        amount: -paidTotal,
        withdrawal_status: "paid",
        occurred_at: toIso(lastPaidDate) ?? toIso(a.latestDate),
        paid_at: toIso(lastPaidDate) ?? toIso(a.latestDate),
        notes: "Resgates pagos (resumo importado do sistema anterior)",
      });
    }
  }
  console.log(`Inserindo ${paidRows.length} resgates pagos (resumo)…`);
  await insertInBatches(supabase, "cashback_ledger", paidRows);

  // 4) Resgate PENDENTE atual (1 por autor) — respeita a trava de saldo do banco
  const pendingRows: Record<string, unknown>[] = [];
  for (const a of authors.values()) {
    const authorId = idByExternal.get(a.externalId);
    if (!authorId || a.pending <= 0) continue;
    pendingRows.push({
      author_id: authorId,
      entry_type: "withdrawal",
      amount: -a.pending,
      withdrawal_status: a.pendingStatus,
      occurred_at: toIso(a.pendingDate ?? a.latestDate),
      approved_at: a.pendingStatus === "approved" ? toIso(a.pendingDate ?? a.latestDate) : null,
      notes: "Resgate pendente (importado do sistema anterior)",
    });
  }
  console.log(`Inserindo ${pendingRows.length} resgates pendentes…`);
  const pendingInserted = await insertInBatches(supabase, "cashback_ledger", pendingRows);
  if (pendingInserted < pendingRows.length) {
    warn(
      `Atenção: ${pendingRows.length - pendingInserted} resgate(s) pendente(s) não entraram ` +
        `(provável saldo insuficiente por inconsistência do CSV — ver acima).`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n== Importador de Cashback ==`);
  console.log(`Arquivo: ${CSV_PATH}`);
  console.log(
    `Modo: ${DRY_RUN ? "SIMULAÇÃO (não grava)" : "IMPORTAÇÃO REAL"}${TRUNCATE ? " + TRUNCATE" : ""}\n`,
  );

  const rows = readCsv(CSV_PATH);
  console.log(`Linhas lidas: ${rows.length}`);

  const authors = aggregate(rows, warn);
  const s = summarize(authors);

  console.log("\n--- Resumo ---");
  console.log(`Autores:                      ${s.authors}`);
  console.log(`Lançamentos de cashback:      ${s.cashbackCount}`);
  console.log(`Total de cashback gerado:     R$ ${s.totalCredited.toFixed(2)}`);
  console.log(`Total já pago (resumido):     R$ ${s.paidTotalAll.toFixed(2)}`);
  console.log(`Resgates pendentes:           ${s.pendingCount}  (R$ ${s.pendingTotal.toFixed(2)})`);
  console.log(`Saldo disponível resultante:  R$ ${s.currentBalance.toFixed(2)}`);
  console.log(`Avisos/anomalias:             ${log.length}`);

  if (!DRY_RUN) {
    console.log("");
    await runImport(authors);
  }

  // Log em arquivo
  const head = [
    `Importação de cashback — ${DRY_RUN ? "SIMULAÇÃO" : "REAL"}`,
    `Arquivo: ${CSV_PATH}`,
    `Autores: ${s.authors} | Cashback: ${s.cashbackCount} | Pendentes: ${s.pendingCount}`,
    `Total gerado: R$ ${s.totalCredited.toFixed(2)} | Pago: R$ ${s.paidTotalAll.toFixed(2)} | Saldo: R$ ${s.currentBalance.toFixed(2)}`,
    `Avisos: ${log.length}`,
    "".padEnd(60, "-"),
  ];
  try {
    writeFileSync(LOG_PATH, [...head, ...log].join("\n"), "utf8");
    console.log(`\nLog salvo em ${LOG_PATH} (${log.length} avisos).`);
  } catch {
    /* ignore */
  }

  console.log(
    DRY_RUN ? "\n✓ Simulação concluída (nada foi gravado).\n" : "\n✓ Importação concluída.\n",
  );
}

main().catch((e) => {
  console.error("✗ Erro fatal:", e);
  process.exit(1);
});
