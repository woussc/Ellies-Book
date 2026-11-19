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
  await page.getByRole("button", { name: /Explore an example/ }).click();
  await navigate(page, "Where I stand", "Overview");
  await page.getByText("No changes recorded yet.", { exact: true }).waitFor();
  await navigate(page, "Plan by category", "Plan");
  const amount = page.getByRole("spinbutton", {
    name: "Home & bills planned amount", exact: true,
  });
  await amount.fill("");
  await amount.pressSequentially("375");
  await amount.press("Enter");
  await navigate(page, "Where I stand", "Overview");
  await page.locator(".audit summary").click();
  const edits = () => page.locator(".audit p").evaluateAll((rows) =>
      rows.map((row) => row.firstChild.textContent)
        .filter((text) => text.startsWith("Home & bills: amount ")),
  );
  const expected = ["Home & bills: amount 2000 → 375"];
  assert.deepEqual(await edits(), expected);
  await page.reload({ waitUntil: "networkidle" });
  await navigate(page, "Where I stand", "Overview");
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
  await navigate(page, "Where I stand", "Overview");
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
  const editor = page.getByRole("textbox", { name: "Budget notes", exact: true });
  const preview = page.getByRole("region", { name: "Budget notes preview", exact: true });
  await editor.fill(note);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await preview.waitFor();
  assert.equal(await editor.count(), 0);
  assert.equal(await preview.getByRole("heading", { name: "Home repairs", exact: true }).count(), 1);
  await page.getByRole("button", { name: "Edit note", exact: true }).click();
  assert.equal(await editor.inputValue(), note);
  assert.equal(await preview.count(), 0);
}

async function checkRemovedCategory(page) {
  await page.getByRole("button", { name: "Money flow", exact: true }).click();
  const picker = page.getByRole("combobox", { name: /^Follow a category/ });
  await picker.selectOption({ label: "A little extra" });
  await navigate(page, "Plan by category", "Plan");
  await page.getByRole("button", { name: "Remove A little extra", exact: true }).click();
  await navigate(page, "Where I stand", "Overview");
  assert.equal(await picker.locator("option:checked").textContent(), "Home & bills");
  assert.equal(await page.locator(".flow-category strong").textContent(), "Home & bills");
  assert.equal(await page.locator(".flow-category b").textContent(), "$375");
  assert.equal(await page.locator(".flow-leaf strong").allTextContents().then((names) => names.includes("November rent")), true);
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
      await checkNoteModes(page);
      await checkRemovedCategory(page);
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
