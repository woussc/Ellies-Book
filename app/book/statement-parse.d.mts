import type { StatementRow } from "./statement-model.mjs";
export type StatementOptions = {
  sourceId: string;
  sourceIndex?: number;
  page?: number;
  dateOrder: "DMY" | "MDY" | "YMD";
  decimal: "." | ",";
  outSign: "negative" | "positive";
  currencyCode: string;
  date?: number;
  description?: number;
  amount?: number;
  out?: number;
  in?: number;
  currency?: number;
  bankId?: number;
  amountFromEnd?: number;
};
export function inspectCsv(content: string): {
  headers: string[];
  records: string[][];
};
export function parseStatementCsv(
  content: string,
  options: StatementOptions,
): StatementRow[];
export function extractStatementLines(
  content: string | string[],
  options: StatementOptions,
): StatementRow[];
export function parseBankAmount(value: string, decimal?: string): number | null;
export function needsStatementOcr(lines: string[]): boolean;
