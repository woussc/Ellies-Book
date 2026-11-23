import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readStatementPdf } from "../app/book/statement-pdf.mjs";
import { extractStatementLines,needsStatementOcr } from "../app/book/statement-parse.mjs";
const fixture = (name) =>
  new URL("./fixtures/statement-import/" + name, import.meta.url);
const options = {
  sourceId: "a".repeat(64),
  dateOrder: "DMY",
  decimal: ".",
  currencyCode: "USD",
  outSign: "negative",
};
test(
  "real text and AES password PDFs feed the same unchecked review rows",
  { timeout: 20000 },
  async () => {
    for (const name of ["statement.pdf", "protected.pdf"]) {
      const passwords = [];
      const pages = await readStatementPdf(await fs.readFile(fixture(name)), {
        password: async (wrong) => {
          passwords.push(wrong);
          return wrong ? "fixture-only" : "wrong";
        },
      });
      const rows = extractStatementLines(pages[0].lines, options);
      assert.equal(rows.length, 2);
      assert.equal(rows[0].amount, 86);
      assert.equal(rows[1].description, "CORNER SHOP");
      assert.equal(rows[0].checked, false);
      assert.deepEqual(
        passwords,
        name === "protected.pdf" ? [false, true] : [],
      );
    }
  },
);
test(
  "cancelled password prompts and damaged PDFs never yield statement rows",
  { timeout: 10000 },
  async () => {
    await assert.rejects(
      readStatementPdf(await fs.readFile(fixture("protected.pdf")), {
        password: async () => null,
      }),
    );
    await assert.rejects(
      readStatementPdf(new TextEncoder().encode("not a pdf")),
    );
  },
);
test(
  "local English OCR reads an image and a real scanned PDF; all readings still require checking",
  { timeout: 60000 },
  async () => {
    const require = createRequire(import.meta.url),
      eng = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
    const { createWorker } = await import("tesseract.js"),
      worker = await createWorker("eng", 1, {
        langPath: join(eng, "4.0.0_best_int"),
        cacheMethod: "none",
      });
    try {
      const image = await worker.recognize(
        await fs.readFile(fixture("screenshot.png")),
      );
      const rows = extractStatementLines(image.data.text, options);
      assert.equal(rows.length, 2);
      assert.equal(rows[0].amount, 86);
      assert.equal(rows[1].checked, false);
      const pdfRequire = createRequire(
          require.resolve("pdfjs-dist/package.json"),
        ),
        { createCanvas } = pdfRequire("@napi-rs/canvas");
      let scannedRows = [];
      for(const name of ['scanned.pdf','hybrid.pdf']){
      await readStatementPdf(await fs.readFile(fixture(name)), {
        onPage: async (page, result) => {
          if(name==='scanned.pdf')assert.equal(result.lines.length, 0);
          else assert.match(result.lines.join(' '),/Statement issued/);
          assert.equal(needsStatementOcr(result.lines),true);
          const viewport = page.getViewport({ scale: 2 }),
            canvas = createCanvas(viewport.width, viewport.height);
          await page.render({
            canvas,
            canvasContext: canvas.getContext("2d"),
            viewport,
          }).promise;
          const read = await worker.recognize(canvas.toBuffer("image/png"));
          scannedRows = extractStatementLines(read.data.text, options);
        },
      });
      assert.equal(scannedRows.length, 2);
      assert.equal(scannedRows[0].amount, 86);
      assert.ok(scannedRows.every((r) => !r.checked));
      }
    } finally {
      await worker.terminate();
    }
  },
);
