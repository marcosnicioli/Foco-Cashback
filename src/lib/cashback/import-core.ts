/**
 * Núcleo PURO do importador de cashback — SEM I/O (nada de arquivo/rede/banco).
 *
 * Concentra a lógica de maior risco da carga inicial (parsing do CSV, correção
 * de acentuação, agregação por autor e resumo/saldo) num módulo importável e
 * testável. O script `scripts/import-cashback.ts` cuida do arquivo e do banco e
 * reusa estas funções. Se mudar uma regra aqui, ajuste o teste ao lado.
 *
 * Este arquivo é auto-contido de propósito (sem imports `@/…`) para o script
 * poder importá-lo via caminho relativo com o tsx.
 */

export interface CsvRow {
  coupon: string;
  order: string;
  date: string;
  prev: number;
  bal: number;
  pending: number;
  situacao: string;
  uid: string;
  name: string;
}

export interface AuthorAgg {
  externalId: string;
  name: string;
  coupon: string | null;
  couponDate: string;
  /**
   * Cashback por número de pedido. O MESMO pedido pode ter vários créditos
   * distintos no sistema anterior (pontos de saldo diferentes) — eles são
   * SOMADOS aqui. Só linhas idênticas (pedido+saldoanterior+saldo) são
   * descartadas como duplicata de export.
   */
  cashback: Map<string, { amount: number; coupon: string; date: string; paid: boolean }>;
  /** Total já pago (soma dos créditos marcados "Resgate Pago", no nível da linha). */
  paidTotal: number;
  latestDate: string;
  pending: number;
  pendingDate: string | null;
  pendingStatus: "requested" | "approved";
}

export interface ImportSummary {
  authors: number;
  cashbackCount: number;
  totalCredited: number;
  paidTotalAll: number;
  pendingCount: number;
  pendingTotal: number;
  currentBalance: number;
}

/** Callback opcional para registrar avisos/anomalias sem depender de I/O. */
export type Warn = (message: string) => void;
const noop: Warn = () => {};

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const toNumber = (s: string): number => {
  const v = parseFloat((s ?? "").trim());
  return Number.isFinite(v) ? v : 0;
};

/** Corrige mojibake (UTF-8 lido como Latin-1): "SalomÃ£o" → "Salomão". */
export function fixText(s: string): string {
  const v = (s ?? "").trim();
  if (!v || !/[ÂÃ]/.test(v)) return v;
  try {
    const bytes = Uint8Array.from([...v].map((c) => c.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return decoded.includes("�") ? v : decoded;
  } catch {
    return v;
  }
}

/** "2025-01-05 22:41:12.170" → ISO com fuso do Brasil (-03:00). */
export function toIso(s: string): string | null {
  const t = (s ?? "").trim().replace(" ", "T");
  if (!t) return null;
  const iso = `${t}-03:00`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/** Parser de UMA linha CSV (respeita aspas e aspas escapadas ""). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else if (c === '"') {
      quoted = true;
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Parseia o texto do CSV em linhas tipadas. Lança se o cabeçalho não tiver as
 * colunas essenciais (id_usuario e saldo). Ignora linhas sem id_usuario (avisa).
 */
export function parseRows(rawText: string, warn: Warn = noop): CsvRow[] {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    coupon: col("identificador"),
    order: col("numeropedido"),
    date: col("datacriacao"),
    prev: col("saldoanterior"),
    bal: col("saldo"),
    pending: col("valorresgatependente"),
    situacao: col("situacao"),
    uid: col("id_usuario"),
    name: col("nome"),
  };
  if (idx.uid < 0 || idx.bal < 0) {
    throw new Error(
      `Cabeçalho do CSV não bate com o esperado. Colunas lidas: ${header.join(", ")}`,
    );
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]!);
    const uid = (f[idx.uid] ?? "").trim();
    if (!uid) {
      warn(`Linha ${i + 1} ignorada: sem id_usuario.`);
      continue;
    }
    rows.push({
      coupon: (f[idx.coupon] ?? "").trim(),
      order: (f[idx.order] ?? "").trim(),
      date: (f[idx.date] ?? "").trim(),
      prev: toNumber(f[idx.prev] ?? ""),
      bal: toNumber(f[idx.bal] ?? ""),
      pending: toNumber(f[idx.pending] ?? ""),
      situacao: (f[idx.situacao] ?? "").trim(),
      uid,
      name: fixText(f[idx.name] ?? ""),
    });
  }
  return rows;
}

/**
 * Agrega as linhas por autor (id_usuario). Cada pedido vira um cashback
 * deduplicado; a última linha de cada autor define pendente/status.
 */
export function aggregate(rows: CsvRow[], warn: Warn = noop): Map<string, AuthorAgg> {
  const authors = new Map<string, AuthorAgg>();
  // Dedup de linhas EXATAS (mesmo pedido + saldoanterior + saldo) por autor.
  const seenExact = new Map<string, Set<string>>();

  for (const r of rows) {
    let a = authors.get(r.uid);
    if (!a) {
      a = {
        externalId: r.uid,
        name: r.name || `Autor ${r.uid}`,
        coupon: null,
        couponDate: "",
        cashback: new Map(),
        paidTotal: 0,
        latestDate: "",
        pending: 0,
        pendingDate: null,
        pendingStatus: "requested",
      };
      authors.set(r.uid, a);
    }
    if (r.name && r.date > a.latestDate) a.name = r.name; // nome mais recente

    // cupom principal = cupom não-vazio mais recente
    if (r.coupon && r.date > a.couponDate) {
      a.coupon = r.coupon;
      a.couponDate = r.date;
    }

    // pendente e status vêm da linha mais recente do autor
    if (r.date > a.latestDate) {
      a.latestDate = r.date;
      a.pending = round2(r.pending);
    }

    if (r.order) {
      // linha de CASHBACK — valor = saldo − saldoanterior
      const delta = round2(r.bal - r.prev);
      if (delta <= 0) {
        warn(`Cashback ignorado (valor ${delta}) autor ${r.uid} pedido ${r.order}.`);
        continue;
      }
      // Duplicata EXATA (a mesma linha repetida no export) → ignora. Mas o MESMO
      // pedido em pontos de saldo DIFERENTES são créditos distintos que o sistema
      // anterior contou separadamente → somamos no crédito do pedido.
      let seen = seenExact.get(r.uid);
      if (!seen) {
        seen = new Set<string>();
        seenExact.set(r.uid, seen);
      }
      const exactKey = `${r.order}|${r.prev}|${r.bal}`;
      if (seen.has(exactKey)) {
        warn(`Linha duplicada exata ignorada: autor ${r.uid} pedido ${r.order}.`);
        continue;
      }
      seen.add(exactKey);

      const paid = r.situacao.toLowerCase().includes("pago");
      const existing = a.cashback.get(r.order);
      if (existing) {
        existing.amount = round2(existing.amount + delta);
        existing.paid = existing.paid || paid;
        if (r.date > existing.date) {
          existing.date = r.date;
          if (r.coupon) existing.coupon = r.coupon;
        }
      } else {
        a.cashback.set(r.order, { amount: delta, coupon: r.coupon, date: r.date, paid });
      }
      // Total pago no NÍVEL DA LINHA (cada crédito distinto marcado "Resgate Pago").
      if (paid) a.paidTotal = round2(a.paidTotal + delta);
    } else {
      // linha SEM pedido = evento de resgate (solicitado / liberado)
      const sit = r.situacao.toLowerCase();
      if (a.pendingDate === null || r.date > a.pendingDate) {
        a.pendingDate = r.date;
        a.pendingStatus = sit.includes("liberado") ? "approved" : "requested";
      }
    }
  }

  return authors;
}

/** Totais para o dry-run e o log. Saldo = gerado − pago − pendente. */
export function summarize(authors: Map<string, AuthorAgg>): ImportSummary {
  let cashbackCount = 0;
  let totalCredited = 0;
  let paidTotalAll = 0;
  let pendingCount = 0;
  let pendingTotal = 0;

  for (const a of authors.values()) {
    for (const c of a.cashback.values()) {
      cashbackCount++;
      totalCredited += c.amount;
    }
    paidTotalAll += a.paidTotal;
    if (a.pending > 0) {
      pendingCount++;
      pendingTotal += a.pending;
    }
  }
  const currentBalance = round2(totalCredited - paidTotalAll - pendingTotal);

  return {
    authors: authors.size,
    cashbackCount,
    totalCredited: round2(totalCredited),
    paidTotalAll: round2(paidTotalAll),
    pendingCount,
    pendingTotal: round2(pendingTotal),
    currentBalance,
  };
}
