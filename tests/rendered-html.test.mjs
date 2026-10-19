import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders Function Budget Studio", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Function Budget Studio/);
  assert.match(html, /Function Library/);
  assert.match(html, /Plan &amp; Budgeting/);
  assert.match(html, /Saved on this device/);
  assert.match(html, /Needs attention/);
  assert.doesNotMatch(html, /profile-function/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview|react-loading-skeleton/i);
});

test("source includes the v2 project-led control model", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /type TagFamily/);
  assert.match(page, /type BudgetRevision/);
  assert.match(page, /Function budget settings/);
  assert.match(page, /Generated ID preview/);
  assert.match(page, /Business intent/);
  assert.match(page, /fiscalPeriodForDate/);
  assert.match(page, /Upload document/);
  assert.match(page, /vendorFolderName/);
  assert.match(page, /AttentionItem/);
  assert.match(page, /family\.selection === "single"/);
  assert.match(page, /selected\.filter\(\(id\) => id !== valueId\)/);
  assert.match(page, /library\.functionPreset/);
  assert.match(page, /Apply preset library/);
  assert.match(page, /rekeyProjectIdentifiers\(next, next\.projects\)/);
  assert.match(page, /librarySection/);
  assert.match(page, /parseDelimitedRows/);
  assert.match(page, /project_id/);
  assert.match(page, /spending_line_id/);
  assert.match(page, /startYear/);
  assert.match(page, /Review allocation/);
  assert.match(page, /Local upload/);
  assert.match(page, /GUC/);
  assert.match(page, /MU/);
  assert.match(page, /FRAG/);
  assert.match(page, /Needs Finance review/);
  assert.match(page, /Measurement window/);
  assert.match(page, /Expected contribution, never proven causation/);
  assert.match(page, /TRAINING_KEY/);
  assert.match(page, /001230/);
  assert.match(page, /safeSpreadsheetText/);
  assert.match(page, /sourceDocumentId/);
  assert.match(page, /sourceDocumentLineId/);
  assert.match(page, /Add line/);
  assert.match(page, /confirmRemoval/);
  assert.match(page, /rekeyProjectIdentifiers/);
  assert.match(page, /type="checkbox"/);
  assert.match(page, /Remove project/);
  assert.match(page, /removeDocument/);
  assert.match(page, /remainder/);
  assert.match(page, /Budget and allocation lines/);
  assert.match(page, /Outcome measures/);
  assert.match(page, /Finance mapping dictionary/);
  assert.doesNotMatch(page, /Project Items/);
  assert.doesNotMatch(page, /ProjectTypeDefinition|indicative unit cost|Eligibility|Source route/);
  assert.match(page, /ProjectWorkPackage/);
  assert.match(page, /SourcingAllocation/);
  assert.match(page, /CurationCandidate/);
  assert.match(page, /ImportReviewRecord/);
  assert.match(page, /Project-only/);
  assert.match(page, /Curation inbox/);
  assert.match(page, /Import planning lines/);
  assert.match(page, /Original \/ Proposed/);
  assert.match(page, /unallocated/);
  assert.match(page, /allocationSubtotal/);
  assert.match(page, /requirementTotal/);
  assert.match(page, /budget-domain\.mjs/);
});
