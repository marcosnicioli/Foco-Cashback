/**
 * Exporta dados para CSV compatível com Excel PT-BR:
 * - separador `;` (padrão do Excel em português)
 * - BOM UTF-8 (acentuação correta)
 * - aspas quando o valor contém `;`, aspas ou quebra de linha
 * - neutraliza injeção de fórmula (CSV/Excel formula injection): valores de
 *   texto iniciados por `= + - @` (tab/CR) são prefixados com `'` para o Excel
 *   não executá-los. Números legítimos (ex.: "-39,29") são preservados.
 *
 * Uso no client (usa Blob + download). O Excel abre o arquivo diretamente.
 */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  // Só dígitos, sinal, separador de milhar/decimal → é número, não fórmula.
  const isPlainNumber = (s: string) => /^[-+]?[\d.,]+$/.test(s);

  const escape = (value: string | number | null | undefined): string => {
    let s = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(s) && !isPlainNumber(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const content = [headers, ...rows].map((row) => row.map(escape).join(";")).join("\r\n");

  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
