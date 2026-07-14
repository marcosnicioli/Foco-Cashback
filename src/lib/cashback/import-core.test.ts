import { describe, expect, it } from "vitest";
import {
  aggregate,
  fixText,
  parseCsvLine,
  parseRows,
  summarize,
  toIso,
  toNumber,
  type Warn,
} from "./import-core";

/** Nomes com acentuação quebrada (mojibake), como vêm do sistema anterior. */
const garbledLeticia = Buffer.from("Letícia Gouveia", "utf8").toString("latin1");
const garbledMarcos = Buffer.from("marcos Costa Salomão", "utf8").toString("latin1");

/** Amostra real (mesma do dry-run validado: 4 autores, saldo R$ 74,72). */
const SAMPLE = [
  "identificador,numeropedido,datacriacao,saldoanterior,saldo,valorresgatependente,situacao,id_usuario,nome",
  `LETICIA20,7440475,2024-07-31 09:36:07.242,0.00,19.92,0.00,Cashback Recebido,154313,${garbledLeticia}`,
  `LETICIA20,7459613,2025-01-05 22:41:12.170,19.92,39.29,0.00,Cashback Recebido,154313,${garbledLeticia}`,
  `,,2025-01-17 19:33:06.203,39.29,0.00,39.29,Resgate Solicitado,154313,${garbledLeticia}`,
  `LETICIA20,7461237,2025-01-21 15:03:20.194,39.29,56.72,39.29,Cashback Recebido,154313,${garbledLeticia}`,
  "FocoCACD,7356965,2023-01-27 02:26:42.949,0.00,19.73,,Resgate Pago,146301,Eduardo Soares",
  ",,2023-10-02 15:46:45.478,19.73,0.00,19.73,Resgate Solicitado,146301,Eduardo Soares",
  ",,2023-10-06 16:22:17.004,19.73,0.00,0.00,Resgate Liberado,146301,Eduardo Soares",
  `MARCOS30,7386988,2023-07-26 16:28:32.917,0.00,18.21,,Resgate Pago,146658,${garbledMarcos}`,
  `MARCOS30,7387961,2023-08-02 10:36:48.678,18.21,29.48,,Resgate Pago,146658,${garbledMarcos}`,
  `MARCOS30,7508585,2026-03-10 20:53:20.354,0.00,13.79,0.00,Cashback Recebido,146658,${garbledMarcos}`,
  `MARCOS30,7509341,2026-03-16 16:44:43.491,13.79,25.45,0.00,Cashback Recebido,146658,${garbledMarcos}`,
  "MAZZEI,7442257,2024-06-10 18:19:46.152,0.00,15.92,0.00,Cashback Recebido,153827,Rodrigo Mazzei",
  "Vadeibdfam,7426041,2024-06-11 10:00:00.000,15.92,31.84,0.00,Cashback Recebido,153827,Rodrigo Mazzei",
].join("\n");

describe("parseCsvLine", () => {
  it("separa por vírgula", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("respeita aspas e aspas escapadas", () => {
    expect(parseCsvLine('a,"b,c","d""e"')).toEqual(["a", "b,c", 'd"e']);
  });
});

describe("toNumber", () => {
  it("converte string em número", () => {
    expect(toNumber("19.92")).toBe(19.92);
  });
  it("vira 0 quando vazio/inválido", () => {
    expect(toNumber("")).toBe(0);
    expect(toNumber("abc")).toBe(0);
  });
});

describe("toIso", () => {
  it("acrescenta o fuso do Brasil", () => {
    expect(toIso("2025-01-05 22:41:12.170")).toBe("2025-01-05T22:41:12.170-03:00");
  });
  it("retorna null para vazio", () => {
    expect(toIso("")).toBeNull();
  });
});

describe("fixText (mojibake)", () => {
  it("corrige UTF-8 lido como Latin-1", () => {
    expect(fixText(garbledLeticia)).toBe("Letícia Gouveia");
    expect(fixText(garbledMarcos)).toBe("marcos Costa Salomão");
  });
  it("mantém texto já correto", () => {
    expect(fixText("Rodrigo Mazzei")).toBe("Rodrigo Mazzei");
  });
});

describe("parseRows", () => {
  it("lê todas as linhas de dados da amostra", () => {
    expect(parseRows(SAMPLE)).toHaveLength(13);
  });

  it("lança se o cabeçalho não tiver as colunas essenciais", () => {
    expect(() => parseRows("foo,bar\n1,2")).toThrow(/Cabeçalho/);
  });

  it("ignora (com aviso) linhas sem id_usuario", () => {
    const warnings: string[] = [];
    const warn: Warn = (m) => warnings.push(m);
    const csv = [
      "identificador,numeropedido,datacriacao,saldoanterior,saldo,valorresgatependente,situacao,id_usuario,nome",
      "CUP,1,2024-01-01 00:00:00,0,10,0,Cashback Recebido,,Sem Id",
    ].join("\n");
    expect(parseRows(csv, warn)).toHaveLength(0);
    expect(warnings.some((w) => w.includes("sem id_usuario"))).toBe(true);
  });
});

describe("aggregate", () => {
  const authors = aggregate(parseRows(SAMPLE));

  it("agrupa por id_usuario (4 autores)", () => {
    expect(authors.size).toBe(4);
  });

  it("corrige o nome do autor (mojibake) e usa o mais recente", () => {
    expect(authors.get("154313")?.name).toBe("Letícia Gouveia");
    expect(authors.get("146658")?.name).toBe("marcos Costa Salomão");
  });

  it("calcula cada cashback como saldo − saldoanterior", () => {
    const leticia = authors.get("154313")!;
    expect(leticia.cashback.size).toBe(3);
    expect(leticia.cashback.get("7440475")?.amount).toBe(19.92);
    expect(leticia.cashback.get("7459613")?.amount).toBe(19.37);
    expect(leticia.cashback.get("7461237")?.amount).toBe(17.43);
  });

  it("marca como pago o cashback cuja situação é 'Resgate Pago'", () => {
    expect(authors.get("146301")?.cashback.get("7356965")?.paid).toBe(true);
    expect(authors.get("146658")?.cashback.get("7386988")?.paid).toBe(true);
    expect(authors.get("146658")?.cashback.get("7508585")?.paid).toBe(false);
  });

  it("pega o resgate pendente e o status da linha mais recente", () => {
    const leticia = authors.get("154313")!;
    expect(leticia.pending).toBe(39.29);
    expect(leticia.pendingStatus).toBe("requested");
    // Eduardo: última linha tem pendente 0 → não fica pendente.
    expect(authors.get("146301")?.pending).toBe(0);
  });

  it("usa o cupom não-vazio mais recente como cupom principal", () => {
    expect(authors.get("153827")?.coupon).toBe("Vadeibdfam"); // 11/06 > 10/06 (MAZZEI)
  });

  const HEADER =
    "identificador,numeropedido,datacriacao,saldoanterior,saldo,valorresgatependente,situacao,id_usuario,nome";

  it("ignora linhas EXATAS duplicadas (mesmo pedido+saldo) com aviso", () => {
    const warnings: string[] = [];
    const warn: Warn = (m) => warnings.push(m);
    const dup = [
      HEADER,
      "CUP,999,2024-01-01 00:00:00,0,10,0,Cashback Recebido,1,Fulano",
      "CUP,999,2024-01-01 00:00:00,0,10,0,Cashback Recebido,1,Fulano",
    ].join("\n");
    const agg = aggregate(parseRows(dup), warn);
    expect(agg.get("1")?.cashback.size).toBe(1);
    expect(agg.get("1")?.cashback.get("999")?.amount).toBe(10); // conta uma vez só
    expect(warnings.some((w) => w.includes("duplicada exata"))).toBe(true);
  });

  it("soma créditos distintos do mesmo pedido (pontos de saldo diferentes)", () => {
    const warnings: string[] = [];
    const warn: Warn = (m) => warnings.push(m);
    // Mesmo pedido contado pelo sistema anterior em dois pontos de saldo → 2 créditos.
    const csv = [
      HEADER,
      "CUP,999,2024-01-01 00:00:00,1000.00,1008.12,0,Cashback Recebido,1,Fulano",
      "CUP,999,2024-01-01 00:00:00,2000.00,2008.13,0,Cashback Recebido,1,Fulano",
    ].join("\n");
    const agg = aggregate(parseRows(csv), warn);
    expect(agg.get("1")?.cashback.size).toBe(1);
    expect(agg.get("1")?.cashback.get("999")?.amount).toBe(16.25); // 8.12 + 8.13
    expect(warnings.some((w) => w.includes("duplicada exata"))).toBe(false);
  });

  it("acumula o total pago no nível da linha (paidTotal)", () => {
    const csv = [
      HEADER,
      "CUP,1,2024-01-01 00:00:00,0,10,0,Resgate Pago,7,Beltrano",
      "CUP,2,2024-02-01 00:00:00,10,25,0,Cashback Recebido,7,Beltrano",
    ].join("\n");
    const a = aggregate(parseRows(csv)).get("7")!;
    expect(a.paidTotal).toBe(10); // só o crédito "Pago"
    expect(a.cashback.size).toBe(2);
  });
});

describe("summarize", () => {
  it("reproduz os totais do dry-run validado (saldo R$ 74,72)", () => {
    const s = summarize(aggregate(parseRows(SAMPLE)));
    expect(s).toEqual({
      authors: 4,
      cashbackCount: 10,
      totalCredited: 163.22,
      paidTotalAll: 49.21,
      pendingCount: 1,
      pendingTotal: 39.29,
      currentBalance: 74.72,
    });
  });
});
