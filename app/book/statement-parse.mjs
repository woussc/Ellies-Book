import Papa from "papaparse";
import { validRepeatDate } from "./repeat-model.mjs";
export function parseBankAmount(value, decimal = ".") {
  let s = String(value ?? "")
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/[−﹣－]/g, "-")
    .replace(/＋/g, "+");
  if (!s) return null;
  s = s.replace(/^(?:USD\s*|\$\s*)/i, "").trim();
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1).trim();
  } else if (/^[+-]/.test(s)) {
    sign = s[0] === "-" ? -1 : 1;
    s = s.slice(1).trim();
  }
  const group = decimal === "." ? "," : ".",
    parts = s.split(decimal);
  if (parts.length > 2 || (parts.length === 2 && !/^\d{1,2}$/.test(parts[1])))
    return null;
  const whole = parts[0].split(group);
  if (
    whole.length > 1 &&
    (!/^\d{1,3}$/.test(whole[0]) ||
      whole.slice(1).some((v) => !/^\d{3}$/.test(v)))
  )
    return null;
  if (whole.some((v) => !/^\d+$/.test(v))) return null;
  const amount = Number(`${whole.join("")}.${parts[1] ?? "0"}`) * sign;
  return Number.isFinite(amount) && Math.abs(amount) <= 1e9 ? amount : null;
}
function bankDate(value, order) {
  const s = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return validRepeatDate(s) ? s : "";
  const match = s.match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/);
  if (!match) return "";
  const bits = match.slice(1),
    tokens = order.split(""),
    get = (t) => bits[tokens.indexOf(t)],
    date = `${get("Y")}-${get("M")?.padStart(2, "0")}-${get("D")?.padStart(2, "0")}`;
  return validRepeatDate(date) ? date : "";
}
export function inspectCsv(content) {
  if (content.length > 10 * 1024 * 1024)
    throw new Error(
      "This CSV is too large. Export a smaller date range (up to 10 MB).",
    );
  const parsed = Papa.parse(content.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
    preview: 1002,
  });
  if (parsed.errors.length || parsed.data.length < 2)
    throw new Error(
      "Could not read a header and payment rows. Check the CSV, or use a PDF or screenshots.",
    );
  if (parsed.meta.truncated || parsed.data.length > 1001)
    throw new Error(
      "Import up to 1,000 rows at a time. Export a smaller date range.",
    );
  if (parsed.data[0].length > 80)
    throw new Error(
      "This file has too many columns. Export only the statement table.",
    );
  return { headers: parsed.data[0].map(String), records: parsed.data.slice(1) };
}
function draft(
  o,
  n,
  raw,
  date,
  description,
  amount,
  direction,
  currency,
  bankId,
) {
  return {
    id: crypto.randomUUID(),
    sourceId: `${o.sourceId}:${n}`,
    date,
    description: description.trim(),
    originalDescription: description.trim(),
    amount: Math.abs(amount ?? 0),
    direction: amount === null ? "unknown" : direction,
    currency: currency || o.currencyCode,
    categoryId: "",
    decision: "new",
    checked: false,
    raw,
    ...(bankId ? { bankId: bankId.trim() } : {}),
    sourceIndex: o.sourceIndex ?? 0,
    page: o.page ?? 1,
  };
}
export function parseStatementCsv(content, o) {
  const { headers, records } = inspectCsv(content);
  const cols = [
    o.date,
    o.description,
    ...(o.amount !== undefined ? [o.amount] : [o.out, o.in]),
  ].filter((v) => v !== undefined);
  if (
    o.date === undefined ||
    o.description === undefined ||
    (o.amount === undefined && o.out === undefined) ||
    new Set(cols).size !== cols.length
  )
    throw new Error("Choose separate date, description and amount columns.");
  if (
    [...cols, o.currency, o.bankId]
      .filter((v) => v !== undefined)
      .some((v) => !Number.isInteger(v) || v < 0 || v >= headers.length)
  )
    throw new Error("A selected column is missing. Choose the columns again.");
  return records.map((cells, i) => {
    const get = (col) =>
      col === undefined ? "" : String(cells[col] ?? "").trim();
    let amount, direction;
    if (o.amount !== undefined) {
      amount = parseBankAmount(get(o.amount), o.decimal);
      direction =
        amount === null
          ? "unknown"
          : (o.outSign === "negative" ? amount < 0 : amount > 0)
            ? "out"
            : "in";
    } else {
      const out = get(o.out),
        incoming = get(o.in),
        debit = out ? parseBankAmount(out, o.decimal) : 0,
        credit = incoming ? parseBankAmount(incoming, o.decimal) : 0;
      amount = debit || credit;
      direction =
        debit === null || credit === null || (debit && credit)
          ? "unknown"
          : debit
            ? "out"
            : "in";
    }
    return draft(
      o,
      i + 1,
      cells.join(" · "),
      bankDate(get(o.date), o.dateOrder),
      get(o.description),
      amount,
      direction,
      o.currency === undefined ? o.currencyCode : get(o.currency),
      get(o.bankId),
    );
  });
}
// Bundled currency codes keep the same fail-closed behavior on older WebKit.
const bankCurrencies = new Set(
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XCG XDR XOF XPF XSU YER ZAR ZMW ZWG ZWL RMB GBX".split(
    " ",
  ),
);
function statementCurrency(raw) {
  const found = new Set();
  for (const match of raw.matchAll(/\b[A-Z]{3}(?=[^A-Z]|$)/g)) {
    const code = match[0];
    if (!bankCurrencies.has(code)) continue;
    const before = raw.slice(0, match.index).split("\n").at(-1),
      after = raw.slice(match.index + 3).split("\n")[0];
    // ALL, TRY, TOP and other ISO codes are ordinary words too. Require a
    // declaration, account label, brackets or adjacency to a monetary value.
    const declared = /\b(?:currency|ccy)\s*[:(]?\s*$/i.test(before);
    const bracketed =
      ["(", "["].some((v) => before.trimEnd().endsWith(v)) &&
      [")", "]"].some((v) => after.trimStart().startsWith(v));
    const money =
      /^\s*[$€£]?\s*[+＋−﹣－-]?\s*\(?\d[\d,.]*[.,]\d{2}/.test(after) ||
      /\d[.,]\d{2}\)?\s*$/.test(before);
    const account =
      (/\b(?:account|statement|balance)\b/i.test(before) && !after.trim()) ||
      /^\s+(?:account|chequing|checking|savings)\b/i.test(after);
    if (
      declared ||
      bracketed ||
      money ||
      account ||
      (!before.trim() && !after.trim())
    )
      found.add(code);
  }
  for (const [pattern, code] of [
    [/€/, "EUR"],
    [/£/, "GBP"],
    [/\bC\$/, "CAD"],
    [/\bS\$/, "SGD"],
    [/\bA\$/, "AUD"],
    [/\bNZ\$/, "NZD"],
    [/\bHK\$/, "HKD"],
    [/\bNT\$/, "TWD"],
    [/\bR\$/, "BRL"],
  ])
    if (pattern.test(raw)) found.add(code);
  if (
    (!found.size || found.has("USD")) &&
    /\p{Sc}/u.test(raw.replace(/[$€£]/g, ""))
  )
    found.add("FOREIGN");
  return found.size > 1 ? "MIXED" : found.values().next().value;
}
export function needsStatementOcr(lines) {
  // A searchable issue date alone says nothing about the payment table.
  return !lines.some((line) =>
    /^\s*\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}\b.*\d[.,]\d{2}(?!\d)/.test(line),
  );
}
export function extractStatementLines(content, o) {
  const lines = Array.isArray(content) ? content : content.split(/\r?\n/),
    headerCurrency = statementCurrency(
      lines
        .filter((line) => !/^\s*\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}\b/.test(line))
        .join("\n"),
    ),
    rows = [];
  lines.forEach((raw, i) => {
    const date = raw.match(/^\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4})\b/);
    if (!date) return;
    const rest = raw.slice(date[0].length).trim(),
      amounts = [
        ...rest.matchAll(
          /(?:^|\s)(?:USD\s*|\$\s*)?(?:\(\d[\d,.]*[.,]\d{2}\)|(?:[+＋]\s*|[−﹣－-])?\d[\d,.]*[.,]\d{2})(?:\s*USD)?(?!\d)/g,
        ),
      ],
      selected = amounts.at(-1 - (o.amountFromEnd ?? 0)),
      amount = selected
        ? parseBankAmount(selected[0].replace(/\s*USD$/i, ""), o.decimal)
        : null;
    const description = rest.slice(0, amounts[0]?.index ?? rest.length).trim();
    const direction =
      amount === null ||
      (selected &&
        amount >= 0 &&
        /[−﹣－-]\s*$/.test(rest.slice(0, selected.index)))
        ? "unknown"
        : (o.outSign === "negative" ? amount < 0 : amount > 0)
          ? "out"
          : "in";
    rows.push(
      draft(
        o,
        i + 1,
        raw,
        bankDate(date[1], o.dateOrder),
        description,
        amount,
        direction,
        statementCurrency(raw) ?? headerCurrency ?? o.currencyCode,
      ),
    );
  });
  return rows;
}
