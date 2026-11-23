import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectCsv,
  parseStatementCsv,
  extractStatementLines,
  parseBankAmount,
} from "../app/book/statement-parse.mjs";
const options = {
  dateOrder: "DMY",
  decimal: ".",
  outSign: "negative",
  currencyCode: "USD",
  sourceId: "a".repeat(64),
};
test("a spaced blank-column dash cannot turn a credit into spending", () => {
  const [r] = extractStatementLines("05/11/2026 CREDIT - 24.90", options);
  assert.equal(r.amount, 24.9);
  assert.equal(r.direction, "unknown");
  const [debit] = extractStatementLines("05/11/2026 SHOP -24.90", options);
  assert.equal(debit.direction, "out");
});
test("ordinary ALL, TOP and TRY headings are not currency declarations", () => {
  for (const heading of [
    "ALL TRANSACTIONS (USD)",
    "TOP PAYMENTS (USD)",
    "TRY AGAIN (USD)",
  ]) {
    assert.equal(
      extractStatementLines(heading + "\n05/11/2026 SHOP -24.90", options)[0]
        .currency,
      "USD",
    );
  }
  for (const hint of [
    "Currency: ALL",
    "Account summary CAD",
    "CAD Chequing",
    "(SGD)",
  ]) {
    assert.notEqual(
      extractStatementLines(hint + "\n05/11/2026 SHOP -24.90", options)[0]
        .currency,
      "USD",
    );
  }
});
test("Unicode minus signs retain spending direction in CSV and PDF readings", () => {
  for (const sign of ["−", "﹣", "－", "-"]) {
    assert.equal(parseBankAmount(sign + " 24.90"), -24.9);
    const [r] = extractStatementLines(`05/11/2026 SHOP ${sign}24.90`, options);
    assert.equal(r.amount, 24.9);
    assert.equal(r.direction, "out");
  }
});
test("PDF currency hints never silently become USD, including page headers", () => {
  for (const currency of ["CAD", "SGD", "AUD", "JPY", "CHF"]) {
    const [r] = extractStatementLines(
      `05/11/2026 SHOP ${currency} -24.90`,
      options,
    );
    assert.equal(r.currency, currency);
    assert.equal(r.amount, 24.9);
  }
  const [header] = extractStatementLines(
    "Account currency: CAD\n05/11/2026 SHOP -24.90",
    options,
  );
  assert.equal(header.currency, "CAD");
  const [symbol] = extractStatementLines("05/11/2026 SHOP C$-24.90", options);
  assert.equal(symbol.currency, "CAD");
  const [plain] = extractStatementLines("05/11/2026 SHOP -24.90", options);
  assert.equal(plain.currency, "USD");
});
test("quoted CSV, explicit dates, signed amounts and bank IDs produce unchecked drafts", () => {
  const csv =
    'Date,Merchant,Amount,ID\n05/11/2026,"Corner store, Main St",-12.50,txn-1\n06/11/2026,Refund,5.00,txn-2';
  assert.equal(inspectCsv(csv).headers.length, 4);
  const rows = parseStatementCsv(csv, {
    ...options,
    date: 0,
    description: 1,
    amount: 2,
    bankId: 3,
  });
  assert.equal(rows[0].description, "Corner store, Main St");
  assert.equal(rows[0].date, "2026-11-05");
  assert.equal(rows[0].amount, 12.5);
  assert.equal(rows[0].direction, "out");
  assert.equal(rows[0].checked, false);
  assert.equal(rows[0].bankId, "txn-1");
  assert.equal(rows[1].direction, "in");
});
test("separate debit/credit and decimal conventions are strict, never rounded or guessed", () => {
  const rows = parseStatementCsv(
    "Date;Text;Debit;Credit\n2026-11-05;Bill;1.234,56;\n2026-11-06;Income;;50,00\n2026-11-07;Unclear;10,00;20,00",
    { ...options, decimal: ",", date: 0, description: 1, out: 2, in: 3 },
  );
  assert.equal(rows[0].amount, 1234.56);
  assert.equal(rows[0].direction, "out");
  assert.equal(rows[1].direction, "in");
  assert.equal(rows[2].direction, "unknown");
  assert.equal(parseBankAmount("1.234", "."), null);
  assert.equal(parseBankAmount("12,34.56", "."), null);
  assert.equal(parseBankAmount("(24.90)", "."), -24.9);
  assert.equal(parseBankAmount("€45.20", "."), null);
});
test("unreadable OCR rows remain visible for correction; statement balances are selectable", () => {
  const rows = extractStatementLines(
    "STATEMENT\n05/11/2026 CITY ENERGY -86.00 1,240.00\n06/11/2026 CORNER SHOP ??\nTotal balance 1,240.00",
    { ...options, amountFromEnd: 1 },
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].amount, 86);
  assert.equal(rows[0].date, "2026-11-05");
  assert.equal(rows[0].checked, false);
  assert.equal(rows[1].amount, 0);
  assert.match(rows[1].raw, /CORNER SHOP/);
});
