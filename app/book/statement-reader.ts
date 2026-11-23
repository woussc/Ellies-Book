import { readStatementPdf } from "./statement-pdf.mjs";
import {needsStatementOcr} from './statement-parse.mjs';
export type StatementPage = {
  number: number;
  lines: string[];
  preview?: string;
};
export type StatementSource = {
  name: string;
  hash: string;
  kind: "csv" | "pdf" | "images";
  csv?: string;
  pages: StatementPage[];
};
export type ImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
  turns: number;
};
type Callbacks = {
  signal: AbortSignal;
  password: (wrong: boolean) => Promise<string | null>;
  progress: (s: string) => void;
  url: (blob: Blob) => string;
};
const assets = () => new URL("statement-assets/", document.baseURI).href;
const aborted = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
};
export async function prepareStatementImage(
  file: Blob,
  crop: ImageCrop,
): Promise<Blob> {
  const image = await createImageBitmap(file);
  try {
    const { x, y, width, height, turns } = crop;
    if (
      ![x, y, width, height, turns].every(Number.isFinite) ||
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0 ||
      x + width > 100 ||
      y + height > 100
    )
      throw new Error(
        "Keep the crop inside the image, with a width and height above zero.",
      );
    const scale = Math.min(
        1,
        2000 /
          Math.max((image.width * width) / 100, (image.height * height) / 100),
      ),
      w = Math.round(((image.width * width) / 100) * scale),
      h = Math.round(((image.height * height) / 100) * scale),
      canvas = document.createElement("canvas");
    canvas.width = turns % 2 ? h : w;
    canvas.height = turns % 2 ? w : h;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error(
        "Image reading is unavailable. Use CSV or add entries by hand.",
      );
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((turns * Math.PI) / 2);
    ctx.drawImage(
      image,
      (image.width * x) / 100,
      (image.height * y) / 100,
      (image.width * width) / 100,
      (image.height * height) / 100,
      -w / 2,
      -h / 2,
      w,
      h,
    );
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(
                new Error(
                  "Could not prepare this image. Try another screenshot.",
                ),
              ),
        "image/png",
      ),
    );
  } finally {
    image.close();
  }
}
export async function readStatementFiles(
  files: File[],
  c: Callbacks,
): Promise<StatementSource[]> {
  if (
    !files.length ||
    files.length > 8 ||
    files.some((f) => f.size > 10 * 1024 * 1024) ||
    files.reduce((n, f) => n + f.size, 0) > 30 * 1024 * 1024
  )
    throw new Error(
      "Choose up to 8 files, each under 10 MB and under 30 MB together.",
    );
  let worker: import("tesseract.js").Worker | undefined;
  let pageCount = 0;
  const terminate = () => {
    void worker?.terminate();
  };
  c.signal.addEventListener("abort", terminate, { once: true });
  const recognize = async (image: HTMLCanvasElement | File) => {
    aborted(c.signal);
    c.progress("Reading on this device… This can take a moment.");
    if (!worker) {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        workerPath: assets() + "worker.min.js",
        corePath: assets(),
        langPath: assets(),
        workerBlobURL: false,
        cacheMethod: "none",
      });
    }
    aborted(c.signal);
    const result = await worker.recognize(image);
    aborted(c.signal);
    return result.data.text.split(/\r?\n/);
  };
  try {
    const sources: StatementSource[] = [];
    for (const file of files) {
      aborted(c.signal);
      c.progress("Opening " + file.name + " on this device…");
      const data = await file.arrayBuffer(),
        hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
      if (/\.csv$/i.test(file.name)) {
        sources.push({
          name: file.name,
          hash,
          kind: "csv",
          csv: new TextDecoder("utf-8", { fatal: true }).decode(data),
          pages: [],
        });
        continue;
      }
      const source: StatementSource = {
        name: file.name,
        hash,
        kind: /\.pdf$/i.test(file.name) ? "pdf" : "images",
        pages: [],
      };
      if (source.kind === "pdf") {
        await readStatementPdf(data, {
          signal: c.signal,
          password: c.password,
          assets: assets() + "pdf/",
          onPage: async (
            page: import("pdfjs-dist").PDFPageProxy,
            result: StatementPage,
          ) => {
            if (++pageCount > 20)
              throw new Error(
                "Read up to 20 pages or images at a time. Choose fewer files.",
              );
            const initial = page.getViewport({ scale: 1 }),
              viewport = page.getViewport({
                scale: Math.min(
                  2,
                  1800 / Math.max(initial.width, initial.height),
                ),
              }),
              canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext("2d");
            if (!context)
              throw new Error(
                "Page previews are unavailable. Use CSV or screenshots.",
              );
            await page.render({ canvas, canvasContext: context, viewport })
              .promise;
            aborted(c.signal);
            const blob = await new Promise<Blob>((resolve, reject) =>
              canvas.toBlob((b) =>
                b
                  ? resolve(b)
                  : reject(
                      new Error("Could not preview this PDF. Try screenshots."),
                    ),
              ),
            );
            if (needsStatementOcr(result.lines))
              result.lines = await recognize(canvas);
            source.pages.push({ ...result, preview: c.url(blob) });
            canvas.width = canvas.height = 0;
          },
        });
      } else {
        if (!/\.(?:png|jpe?g)$/i.test(file.name))
          throw new Error("Choose CSV, PDF, PNG or JPG files.");
        if (++pageCount > 20)
          throw new Error("Read up to 20 pages or images at a time.");
        const canvasBlob = await prepareStatementImage(file, {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          turns: 0,
        });
        const ready = new File([canvasBlob], file.name, { type: "image/png" });
        source.pages = [
          {
            number: 1,
            preview: c.url(canvasBlob),
            lines: await recognize(ready),
          },
        ];
      }
      sources.push(source);
    }
    return sources;
  } finally {
    c.signal.removeEventListener("abort", terminate);
    await worker?.terminate();
  }
}
