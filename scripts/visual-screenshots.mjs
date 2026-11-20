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
  await navigate(page, "Plan by category", "Plan");
  const amount = page.getByRole("spinbutton", {
    name: "Home & bills planned amount", exact: true,
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

  await navigate(page, "Plan by category", "Plan");
  const zeroAmount = page.getByRole("spinbutton", {
    name: "Food & groceries planned amount", exact: true,
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
  await navigate(page, "Plan by category", "Plan");
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

async function checkNoteModes(page) {
  const note = "# Home repairs\nKeep this edit.";
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.getByRole("textbox", { name: "Find a node", exact: true }).fill("Notes");
  await page.locator(".canvas-find").getByRole("button", {name: "Open Notes", exact: true}).click();
  const detail = page.locator(".node-detail");
  await detail.getByRole("button", {name: "Edit notes", exact: true}).click();
  const editor = detail.getByRole("textbox", {name: "Markdown notes", exact: true});
  await editor.fill(note);
  await detail.getByRole("button", {name: "Save notes", exact: true}).click();
  assert.equal(await editor.count(), 0);
  assert.equal(await detail.getByRole("heading", {name: "Home repairs", exact: true}).count(), 1);
  await detail.getByRole("button", {name: "Edit notes", exact: true}).click();
  assert.equal(await editor.inputValue(), note);
  await detail.getByRole("button", {name: "Cancel", exact: true}).click();
  await detail.getByRole("button", {name: "Close ×", exact: true}).click();
}

async function checkRemovedCategory(page) {
  await navigate(page, "Plan by category", "Plan");
  await page.getByRole("button", { name: "Remove A little extra", exact: true }).click();
  await navigate(page, "Your board", "Board");
  await page.getByRole("button", {name: "Board tools", exact: true}).click();
  await page.getByRole("button", {name: "List", exact: true}).click();
  assert.equal(await page.getByRole("button", {name: "Open A little extra", exact: true}).count(), 0);
  assert.equal(await page.getByRole("button", {name: "Open November rent", exact: true}).count(), 1);
  await page.getByRole("button", {name: "Open Home & bills", exact: true}).click();
  assert.match(await page.locator(".detail-metrics").innerText(), /\$375/);
  await page.locator(".node-detail").getByRole("button", {name: "Close ×", exact: true}).click();
}

async function checkBoardLayout(page) {
  assert.equal(await page.locator(".widget-toolbar > select").inputValue(), "overview", "Financial overview is home at every viewport");
  const stored = async () => activeBudget(parseLibrary(await page.evaluate(() => localStorage.getItem("ellies-book:library:v1.md"))));
  const before = await stored();
  const clipped = await page.locator(".canvas-node .widget-value").evaluateAll(elements => elements.filter(element => {
    const content = element.closest(".widget-surface").getBoundingClientRect(), rect = element.getBoundingClientRect();
    return rect.bottom > content.bottom + 1 || rect.top < content.top - 1;
  }).map(element => element.textContent));
  assert.deepEqual(clipped, [], "Essential amounts must fit inside compact widgets");
  await page.getByRole("button", {name: "Arrange", exact: true}).click();
  await page.getByRole("button", {name: "Size", exact: true}).click();
  const sizes = page.locator(".size-dialog");
  assert.equal(await sizes.getByRole("button", {name: /^Small/}).isDisabled(), true);
  await sizes.getByRole("button", {name: /^Large/}).click();
  await sizes.getByRole("button", {name: "Apply size", exact: true}).click();
  await page.getByRole("button", {name: "Drag or select Budget", exact: true}).press("ArrowRight");
  await page.getByRole("button", {name: "Done", exact: true}).click();
  const after = await stored();
  assert.equal(after.board.canvas.sizes.budget, "large");
  assert.ok(after.board.canvas.scenes.overview.positions.budget.x > 0);
  delete before.board;
  delete after.board;
  assert.deepEqual(after, before, "Layout edits must not alter financial records, notes, or audit history");
  await page.reload({waitUntil: "networkidle"});
  assert.equal((await stored()).board.canvas.sizes.budget, "large");
  await page.getByRole("button", {name: "Arrange", exact: true}).click();
  await page.getByRole("button", {name: "Balance cluster", exact: true}).click();
  await page.getByRole("button", {name: "Done", exact: true}).click();
  assert.deepEqual((await stored()).board.canvas.scenes.overview.positions, {});
  const budgetFace = page.getByRole("button", {name: "Select Budget", exact: true});
  if (await budgetFace.getAttribute("aria-pressed") !== "true") await budgetFace.click();
  await page.waitForTimeout(650);
  const canvasTop = (await page.locator(".canvas-window").boundingBox()).y;
  const beforeDrag = await page.evaluate(() => ({scroll: window.scrollY, toolbar: document.querySelector(".widget-toolbar").getBoundingClientRect().height}));
  const face = await budgetFace.boundingBox();
  await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2);
  await page.mouse.down();
  await page.mouse.move(face.x + face.width / 2 + 32, face.y + face.height / 2 + 32, {steps: 6});
  await page.getByRole("button", {name: "Cancel", exact: true}).waitFor();
  await page.waitForTimeout(100);
  const afterTop = (await page.locator(".canvas-window").boundingBox()).y;
  const afterDrag = await page.evaluate(() => ({scroll: window.scrollY, toolbar: document.querySelector(".widget-toolbar").getBoundingClientRect().height}));
  assert.ok(Math.abs(afterTop - canvasTop) <= 1, `automatic Arrange keeps the canvas under the pointer: ${JSON.stringify({canvasTop,afterTop,beforeDrag,afterDrag})}`);
  const heldFace = await page.getByRole("button", {name: "Drag or select Budget", exact: true}).boundingBox();
  assert.ok(Math.abs(heldFace.x - face.x - 32) <= 2 && Math.abs(heldFace.y - face.y - 32) <= 2, `the grabbed widget follows the pointer through automatic Arrange: ${JSON.stringify({face,heldFace})}`);
  await page.mouse.up();
  await page.getByRole("button", {name: "Cancel", exact: true}).click();
  await page.getByRole("button", {name: "Board tools", exact: true}).click();
  await page.getByRole("button", {name: "Zoom in", exact: true}).click();
  await page.waitForTimeout(300);
  const camera = await page.locator(".canvas-world").getAttribute("style");
  const scroll = await page.evaluate(() => window.scrollY);
  await navigate(page, "Plan by category", "Plan");
  await navigate(page, "Your board", "Board");
  assert.equal(await page.locator(".canvas-world").getAttribute("style"), camera, "Plan round trip preserves the live camera");
  assert.equal(await page.getByRole("button", {name: "Select Budget", exact: true}).getAttribute("aria-pressed"), "true");
  await page.waitForFunction(y => Math.abs(window.scrollY - y) <= 1, scroll);
  await page.locator(".widget-inspector").getByRole("button", {name: "Open Budget", exact: true}).click();
  await page.getByRole("button", {name: "Edit plan", exact: true}).click();
  await page.waitForFunction(() => !document.querySelector("dialog[open]") && document.body.style.overflow !== "hidden");
  await navigate(page, "Your board", "Board");
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
