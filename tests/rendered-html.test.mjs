import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createRequire } from "node:module";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

async function pageComponents(names) {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(declarations.length, names.length);
  const code = declarations.map((node) => node.getText(ast)).join("\n");
  const { outputText } = ts.transpileModule(`${code}\nexport { ${names.join(", ")} };`, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  new Function("require", "exports", outputText)(createRequire(import.meta.url), exports);
  return exports;
}

function inputs(element) {
  if (!element || typeof element !== "object") return [];
  if (element.type === "input") return [element];
  return [element.props?.children].flat(Infinity).flatMap(inputs);
}

test("project Save errors explain every blocker and stay absent for valid drafts", async () => {
  const { ProjectSaveErrors } = await pageComponents(["ProjectSaveErrors"]);
  assert.equal(renderToStaticMarkup(createElement(ProjectSaveErrors, { errors: [] })), "");
  const errors = [
    { key: "project.businessIntent", message: "Choose one Business intent tag before saving the project." },
    { key: "line.test.comment", message: "Add an adjustment comment for this changed spending line." },
  ];
  const html = renderToStaticMarkup(createElement(ProjectSaveErrors, { errors }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Project not saved/);
  for (const error of errors) assert.ok(html.includes(error.message));
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Save Original \/ Proposed<\/AppButton><\/div><\/div><ProjectSaveErrors errors=\{errors\}/);
});

test("TagPicker preserves Efficiency after Multiple -> Single then untick Growth", async () => {
  const { TagPicker } = await pageComponents(["TagPicker", "tagValueFor"]);
  const intent = { id: "tag-business-intent", name: "Business intent", selection: "multi", values: [
    { id: "growth", name: "Growth" }, { id: "efficiency", name: "Efficiency" },
  ] };
  const data = { library: { tagFamilies: [intent, { id: "type", name: "Type", selection: "single", values: [{ id: "campaign", name: "Campaign" }] }] } };
  let selected = ["campaign"];
  const render = (label = "Project metadata tags") => TagPicker({ data, selected, label, idPrefix: "test", onChange: (ids) => { selected = ids; } });
  const click = (id, label) => inputs(render(label)).find((input) => input.props.id === `test-${id}`).props.onChange();
  click("growth");
  click("efficiency");
  assert.deepEqual(selected, ["campaign", "growth", "efficiency"]);
  intent.selection = "single";
  click("growth");
  assert.deepEqual(selected, ["campaign", "efficiency"]);
  assert.equal(inputs(render()).find((input) => input.props.id === "test-efficiency").props.checked, true);
  click("efficiency");
  assert.deepEqual(selected, ["campaign", "efficiency"], "last required intent stays selected");
  click("growth");
  assert.deepEqual(selected, ["campaign", "growth"], "selecting a new intent replaces the old in Single mode");
  click("growth", "Optional tags");
  assert.deepEqual(selected, ["campaign"], "optional selections can be cleared");
  selected = [];
  click("growth");
  assert.deepEqual(selected, ["growth"], "empty intent can be repaired");
});

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
  // Wave 10 WS-A removed training mode end-to-end. Guard the new reality:
  // the training key and training-mode branch are gone, the default landing
  // is built from blankData(), and the sample dataset loads on demand via
  // loadSampleData() -> sampleData().
  assert.doesNotMatch(page, /TRAINING_KEY/);
  assert.doesNotMatch(page, /mode === "training"/);
  assert.match(page, /blankData/);
  assert.match(page, /sampleData\(\)/);
  assert.match(page, /loadSampleData/);
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
