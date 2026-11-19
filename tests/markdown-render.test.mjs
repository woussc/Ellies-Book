import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Exercise the shared TSX renderer without adding a second test runtime.
const { outputText } = ts.transpileModule(
  readFileSync(new URL("../app/markdown-render.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
);
const moduleExports = {};
new Function("require", "exports", outputText)(createRequire(import.meta.url), moduleExports);
const render = (markdown, handlers) => renderToStaticMarkup(
  createElement("div", null, moduleExports.renderMarkdownDocument(markdown, handlers)),
);

test("shared report renders headings and bullets with plain wikilink labels", () => {
  const html = render("# December decision\n\n- Keep the original invoice\n- [[Studio tools]] and [[category-id|Other tools]]");
  assert.match(html, /<h1[^>]*>December decision<\/h1>/);
  assert.match(html, /<ul[^>]*><li[^>]*>Keep the original invoice<\/li>/);
  assert.match(html, /Studio tools and Other tools/);
  assert.doesNotMatch(html, /<button|\[\[|# December|- Keep/);
});

test("notes Preview keeps interactive wikilinks and report text stays escaped", () => {
  const html = render("[[Studio tools]]", { onWikilink() {}, onTag() {} });
  assert.match(html, /<button[^>]*class="eb-wikilink-pill"/);
  assert.match(html, /\[\[Studio tools\]\]/);
  assert.doesNotMatch(render("<script>alert(1)</script>"), /<script>/);
  assert.match(render("<script>alert(1)</script>"), /&lt;script&gt;/);
});
