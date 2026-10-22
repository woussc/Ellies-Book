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
      const outPath = `${OUT_DIR}/${vp.label}.png`;
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`Captured ${vp.label} (${vp.width}px) -> ${outPath}`);
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
