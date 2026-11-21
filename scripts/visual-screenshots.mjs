// Capture full-page screenshots of the running app at desktop, tablet, and
// phone breakpoints and write them as PNGs for CI to upload as artifacts.
//
// Used by .github/workflows/ci.yml (visual-screenshots job). It expects the
// built app to already be served locally (vinext start). It is intentionally
// dependency-light: it imports chromium from the `playwright` package, which
// the workflow installs for this job only.
//
// Environment:
//   BASE_URL         URL of the running app (default http://localhost:3000/)
//   SCREENSHOT_OUT   output directory for PNGs (default artifacts/screenshots)

import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { activeBudget, parseLibrary } from "../app/book/library-model.mjs";
import { serializeBook } from "../app/book/model.mjs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000/";
const OUT_DIR = process.env.SCREENSHOT_OUT || "artifacts/screenshots";

// The three breakpoints the project reviews (see AGENTS.md / ADR 0002).
const VIEWPORTS = [
  { label: "desktop-1440", width: 1440, height: 900 },
  { label: "tablet-768", width: 768, height: 1024 },
  { label: "phone-390", width: 390, height: 844 },
];

// Poll the server until it answers, up to ~60s, before taking screenshots.
async function waitForServer(url, { attempts = 60, delayMs = 1000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) {
        console.log(`Server is ready at ${url} (HTTP ${res.status})`);
        return;
      }
      console.log(`Attempt ${i}/${attempts}: HTTP ${res.status}, retrying...`);
    } catch (err) {
      console.log(`Attempt ${i}/${attempts}: ${err.message}, retrying...`);
    }
    await sleep(delayMs);
  }
  throw new Error(`Server did not become ready at ${url} within ${attempts}s`);
}

async function navigate(page, desktop, mobile) {
  const button = page.getByRole("button", { name: desktop, exact: true });
  await (await button.isVisible()
    ? button
    : page.getByRole("button", { name: mobile, exact: true })
  ).click();
  // Navigation deliberately moves focus to the new heading on the next task.
  // Wait for that handoff before editing; otherwise it can blur a just-cleared
  // amount and turn one simulated edit into two commits on a fast CI runner.
  await page.waitForFunction(() => document.activeElement?.tagName === "H1");
}

async function checkSkipLink(page) {
  const skip = page.getByRole("link", { name: "Skip to content", exact: true });
  const layout = () => page.locator(".sidebar, .main-column").evaluateAll((elements) =>
    elements.map((element) => {
      const { top, left, width, height } = element.getBoundingClientRect();
      return { top, left, width, height };
    }),
  );
  const before = await layout();
  assert.equal(await skip.evaluate((element) => getComputedStyle(element).position), "fixed");
  assert.equal(await skip.evaluate((element) => getComputedStyle(element).clipPath), "inset(50%)");
  await page.keyboard.press("Tab");
  assert.equal(await skip.evaluate((element) => element.matches(":focus-visible")), true);
  assert.equal(await skip.evaluate((element) => getComputedStyle(element).clipPath), "none");
  assert.deepEqual(await layout(), before);
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "main");
  await page.getByRole("heading", { level: 1 }).first().click();
  assert.equal(await skip.evaluate((element) => getComputedStyle(element).clipPath), "inset(50%)");
}

// Exercise the public editing/activity seam in each reviewed viewport. Typing
// the final amount must not turn its intermediate digits into audit events.
async function checkCategoryEdit(page) {
  await page.getByRole("textbox", {name: "Book name", exact: true}).fill("Example book");
  await page.getByRole("button", {name: /^Continue/}).click();
  await page.getByRole("button", { name: /Explore an example/ }).click();
  await navigate(page, "Your board", "Board");
  await page.getByText("No changes recorded yet.", { exact: true }).waitFor();
  await openAllocations(page);
  const amount = page.getByRole("spinbutton", {
    name: "Home & bills allocation", exact: true,
  });
  await amount.fill("");
  await amount.pressSequentially("375");
  await amount.press("Enter");
  await navigate(page, "Your board", "Board");
  await page.locator(".audit summary").click();
  const edits = () => page.locator(".audit p").evaluateAll((rows) =>
      rows.map((row) => row.firstChild.textContent)
        .filter((text) => text.startsWith("Home & bills: amount ")),
  );
  const expected = ["Home & bills: amount 2000 → 375"];
  assert.deepEqual(await edits(), expected);
  await page.reload({ waitUntil: "networkidle" });
  await navigate(page, "Your board", "Board");
  await page.locator(".audit summary").click();
  assert.deepEqual(await edits(), expected, "Saved activity must survive reload");

  await openAllocations(page);
  const zeroAmount = page.getByRole("spinbutton", {
    name: "Food & groceries allocation", exact: true,
  });
  await zeroAmount.fill("0");
  await zeroAmount.press("Tab");
  assert.equal(await zeroAmount.inputValue(), "");
  for (const [value, key] of [["-5", "Tab"], ["", "Enter"], ["0.001", "Tab"]]) {
    await zeroAmount.fill("");
    await zeroAmount.pressSequentially(value);
    assert.equal(await zeroAmount.inputValue(), value, "Precondition: the actual draft is present before commit");
    await zeroAmount.press(key);
    assert.equal(await zeroAmount.inputValue(), "", "Normalized zero must replace the finished draft");
  }
  await amount.fill("");
  await amount.pressSequentially("375.001");
  assert.equal(await amount.inputValue(), "375.001");
  await amount.press("Enter");
  assert.equal(await amount.inputValue(), "375", "Unchanged rounded amounts must replace the draft");
  await page.reload({ waitUntil: "networkidle" });
  await openAllocations(page);
  assert.equal(await amount.inputValue(), "375");
  assert.equal(await zeroAmount.inputValue(), "");
  await navigate(page, "Your board", "Board");
  await page.locator(".audit summary").click();
  assert.deepEqual(await edits(), expected);
  const zeroEdits = await page.locator(".audit p").evaluateAll((rows) =>
    rows.map((row) => row.firstChild.textContent)
      .filter((text) => text.startsWith("Food & groceries: amount ")),
  );
  assert.deepEqual(zeroEdits, ["Food & groceries: amount 900 → 0"], "Normalized no-ops must not create audit events");
}

async function openAllocations(page) {
  await navigate(page, "Your board", "Board");
  await page.getByRole("button", {name: "Open budget details", exact: true}).click();
  await navigate(page, "Budget settings", "Budget settings");
  await navigate(page, "Edit category allocations", "Edit category allocations");
  await page.getByRole("heading", {name: "Category allocations", exact: true}).waitFor();
}

async function checkNoteModes(page) {
  const note = "# Home repairs\nKeep this edit. [[Home & bills]]";
  await navigate(page, "Entries", "Entries");
  await page.getByRole("button", {name: /^Edit November rent,/}).click();
  const editor = page.getByRole("textbox", {name: "Entry note (Markdown)", exact: true});
  await editor.fill(note);
  await page.getByRole("button", {name: "Save changes", exact: true}).click();
  await navigate(page, "Your board", "Board");
  await page.locator('[data-garden-node="category:category-0"]').click();
  await page.locator(".garden-entry-open").filter({hasText:"November rent"}).click();
  const detail = page.locator(".garden-dialog");
  await detail.getByRole("heading", {name:"Home repairs",exact:true}).waitFor({state:"visible"});
  await detail.getByRole("button", {name:"[[Home & bills]]",exact:true}).click();
  await detail.getByRole("heading", {name:"Home & bills",exact:true}).waitFor({state:"visible"});
  await detail.getByRole("button", {name:"Close",exact:true}).click();
  await navigate(page, "Entries", "Entries");
  await page.getByRole("button", {name:/^Edit November rent,/}).click();
  assert.equal(await editor.inputValue(),note);
  await page.locator(".spending-form").getByRole("button", {name:"Cancel",exact:true}).click();
  await navigate(page, "Your board", "Board");
}

async function checkRemovedCategory(page) {
  await openAllocations(page);
  await page.getByRole("button", { name: "Remove A little extra", exact: true }).click();
  await navigate(page, "Your board", "Board");
  assert.equal(await page.locator('[data-garden-node="category:category-4"]').count(),0);
  assert.equal(await page.locator(".garden-entry-open").filter({hasText:"November rent"}).count(),1);
  await page.locator('[data-garden-node="category:category-0"]').click();
  assert.match(await page.locator(".garden-detail-metrics").innerText(), /\$375\.00/);
  await page.locator(".garden-dialog").getByRole("button", {name:"Close",exact:true}).click();
}

async function checkReportAndAudit(page) {
  const budget=activeBudget(parseLibrary(await page.evaluate(()=>localStorage.getItem("ellies-book:library:v1.md"))));
  await page.getByRole("button",{name:"Report",exact:true}).click();
  assert.ok((await page.locator(".report-period").innerText()).includes(budget.startDate));
  assert.ok((await page.locator(".report-period").innerText()).includes(budget.endDate));
  assert.match(await page.locator(".report-entry-notes").innerText(),/November rent[\s\S]*Home repairs[\s\S]*Keep this edit/);
  await page.getByRole("button",{name:"Ask AI",exact:true}).click();
  const entryNoteCount=budget.expenses.filter(entry=>entry.notes).length;
  assert.equal(await page.locator(".ai-share-contents").getByText(`${entryNoteCount} entry ${entryNoteCount===1?"note":"notes"}`,{exact:true}).count(),1,"Sharing disclosure must count entry-owned notes, not only project notes");
  await page.locator(".ai-exact-copy summary").click();
  assert.match(await page.getByRole("textbox",{name:"Exact copy",exact:true}).inputValue(),/Home repairs[\s\S]*Keep this edit/);
  await page.locator(".ai-sheet").getByRole("button",{name:"Close",exact:true}).click();
  await page.emulateMedia({media:"print"});
  assert.equal(await page.locator(".report-entry-notes").isVisible(),true);
  for (const selector of [".product-topbar", ".mobile-nav", ".page-heading", ".report-actions"]) {
    assert.equal(await page.locator(selector).isVisible(), false, `${selector} must not consume space on the first printed page`);
  }
  await page.emulateMedia({media:"screen"});
  await navigate(page,"Your board","Board");
  if(page.viewportSize().width<=640) {
    const audit=page.locator(".audit");
    if(await audit.getAttribute("open")!==null) await audit.locator("summary").click();
    await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    const summary=await audit.locator("summary").boundingBox(),nav=await page.locator(".mobile-nav").boundingBox();
    assert.ok(summary.y+summary.height<=nav.y,"Collapsed audit must be above fixed phone navigation at maximum scroll");
    await audit.locator("summary").click();
  }
}

async function checkBoardLayout(page) {
  await page.locator(".project-garden").waitFor();
  const stored = async () => activeBudget(parseLibrary(await page.evaluate(() => localStorage.getItem("ellies-book:library:v1.md"))));
  const before = await stored();
  const clipped = await page.locator(".garden-node .money").evaluateAll(elements => elements.filter(element => {
    const content = element.closest(".garden-node").getBoundingClientRect(), rect = element.getBoundingClientRect();
    return rect.left < content.left || rect.right > content.right || rect.bottom > content.bottom || rect.top < content.top;
  }).map(element => element.textContent));
  assert.deepEqual(clipped, [], "Exact amounts must fit inside their own node");
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole("button", {name: "Arrange", exact: true}).click();
  await page.locator(".garden-budget-block").getByRole("button", {name:"Resize budget",exact:true}).click();
  const secondCategory = before.categories[1].id;
  await page.locator(`[data-category-id="${secondCategory}"]`).getByRole("button",{name:"Move category earlier",exact:true}).click();
  await page.getByRole("button", {name: "Done arranging", exact: true}).click();
  const after = await stored();
  assert.equal(after.board.canvas.sizes.budget, "large");
  assert.equal(after.board.nodeOrder[0],secondCategory);
  delete before.board;
  delete after.board;
  assert.deepEqual(after, before, "Layout edits must not alter financial records, notes, or audit history");
  await page.reload({waitUntil: "networkidle"});
  assert.equal((await stored()).board.canvas.sizes.budget, "large");
  assert.equal((await stored()).board.nodeOrder[0],secondCategory);
  const category=page.locator(`[data-garden-node="category:${secondCategory}"]`);
  await category.click();
  await page.locator(".garden-trail").waitFor();
  // Desktop navigation is in document flow; phones keep a fixed bottom bar.
  await page.getByRole("button",{name:"Entries",exact:true}).scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  await navigate(page, "Entries", "Entries");
  await navigate(page, "Your board", "Board");
  assert.equal(await category.getAttribute("aria-expanded"),"true","Entries round trip preserves selected category");
  await page.waitForFunction(y => Math.abs(window.scrollY - y) <= 1, scroll);
  await page.getByRole("button", {name:"Open budget details",exact:true}).click();
  assert.match(await page.locator(".garden-dialog").innerText(), /Forecast Spend \$1,971\.50 · Projected Headroom \$3,028\.50/);
  await page.getByRole("button", {name:"Budget settings",exact:true}).click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]") && document.body.style.overflow !== "hidden");
  await navigate(page, "Your board", "Board");
  await page.getByRole("button",{name:"Show categories",exact:true}).click();
}

async function checkRestoreFeedback(page) {
  const before = parseLibrary(await page.evaluate(() => localStorage.getItem("ellies-book:library:v1.md")));
  const project = {...activeBudget(before), id: "ci-restored-project", name: "Restored project", sample: false};
  await navigate(page, "Your books", "Books");
  await page.getByLabel("Restore / add books", {exact: true}).setInputFiles({
    name: "project-backup.md", mimeType: "text/markdown", buffer: Buffer.from(serializeBook(project)),
  });
  await page.getByRole("heading", {name: "Your books", exact: true}).waitFor();
  await page.getByText("Backup added as new books. Your other projects are unchanged.", {exact: true}).waitFor();
  assert.equal(await page.getByRole("button", {name: "Open Restored project", exact: true}).count(), 1);
  const after = parseLibrary(await page.evaluate(() => localStorage.getItem("ellies-book:library:v1.md")));
  assert.deepEqual(after.example, before.example);
  assert.equal(after.books.length, before.books.length + 1);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await waitForServer(BASE_URL);

  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await checkSkipLink(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      const outPath = `${OUT_DIR}/${vp.label}.png`;
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`Captured ${vp.label} (${vp.width}px) -> ${outPath}`);
      await checkCategoryEdit(page);
      await checkBoardLayout(page);
      await page.screenshot({ path: `${OUT_DIR}/${vp.label}-board.png`, fullPage: true });
      await checkNoteModes(page);
      await checkReportAndAudit(page);
      await checkRemovedCategory(page);
      await checkRestoreFeedback(page);
      console.log(`Passed keyboard, category-edit, note-mode and removed-category regressions at ${vp.width}px`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
