import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { Plugin } from "vite";
// Ship extraction engines and English recognition data with every deployment.
// No statement, password, image, or OCR request is sent to a CDN/service.
export function statementAssets(): Plugin {
  const require = createRequire(import.meta.url),
    tess = dirname(require.resolve("tesseract.js/package.json")),
    tr = createRequire(join(tess, "package.json")),
    core = dirname(tr.resolve("tesseract.js-core/package.json")),
    pdf = dirname(require.resolve("pdfjs-dist/package.json")),
    eng = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
  const files = new Map<string, string>();
  // vinext start serves emitted assets under /_next/static, not arbitrary
  // output-root files. Pages and the native bundle can use the same path.
  const root = "_next/static/statement-assets/";
  for (const [label, folder] of [
    ["pdfjs", pdf],
    ["tesseract", tess],
    ["tesseract-core", core],
    ["english-data", eng],
  ])
    for (const name of ["LICENSE", "LICENSE.md", "LICENSE.txt"])
      if (existsSync(join(folder, name)))
        files.set(`${root}licenses/${label}-${name}.txt`, join(folder, name));
  files.set(root + "worker.min.js", join(tess, "dist/worker.min.js"));
  for (const name of readdirSync(core).filter((n) =>
    /^tesseract-core(?:-simd)?-lstm\.wasm(?:\.js)?$/.test(n),
  ))
    files.set(root + name, join(core, name));
  files.set(
    // Keep the packaged gzip bytes; Tesseract detects their magic header.
    // A .gz-only URL is treated as a missing precompressed variant by vinext.
    root + "eng.traineddata",
    join(eng, "4.0.0_best_int/eng.traineddata.gz"),
  );
  files.set(
    root + "pdf/pdf.worker.min.mjs",
    join(pdf, "legacy/build/pdf.worker.min.mjs"),
  );
  for (const folder of ["cmaps", "standard_fonts", "wasm"])
    for (const name of readdirSync(join(pdf, folder)))
      files.set(`${root}pdf/${folder}/${name}`, join(pdf, folder, name));
  return {
    name: "statement-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURI((req.url ?? "").split("?")[0]).replace(
          /^\//,
          "",
        );
        const file =
          files.get(path) ||
          [...files].find(([name]) => path.endsWith("/" + name))?.[1];
        if (!file) return next();
        res.setHeader(
          "Content-Type",
          file.endsWith(".mjs") || file.endsWith(".js")
            ? "text/javascript"
            : file.endsWith(".wasm")
              ? "application/wasm"
              : "application/octet-stream",
        );
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const [fileName, file] of files) {
        this.emitFile({ type: "asset", fileName, source: readFileSync(file) });
      }
    },
  };
}
