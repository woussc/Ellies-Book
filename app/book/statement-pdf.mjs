// Shared browser/Node PDF seam. Never retain a password after PDF.js opens it.
export async function readStatementPdf(
  data,
  { password = async () => null, onPage = async () => {}, signal, assets } = {},
) {
  const pdf = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (assets) pdf.GlobalWorkerOptions.workerSrc = assets + "pdf.worker.min.mjs";
  const task = pdf.getDocument({
    data: new Uint8Array(data),
    isEvalSupported: false,
    ...(assets
      ? {
          cMapUrl: assets + "cmaps/",
          cMapPacked: true,
          standardFontDataUrl: assets + "standard_fonts/",
          wasmUrl: assets + "wasm/",
        }
      : {}),
  });
  const cancel = () => {
    void task.destroy();
  };
  signal?.addEventListener("abort", cancel, { once: true });
  task.onPassword = (update, reason) => {
    void password(reason === pdf.PasswordResponses.INCORRECT_PASSWORD)
      .then((value) => {
        if (value === null || signal?.aborted) cancel();
        else update(value);
      })
      .catch(cancel);
  };
  try {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const doc = await task.promise;
    if (doc.numPages > 20)
      throw new Error(
        "This PDF has more than 20 pages. Export a smaller date range or use screenshots.",
      );
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const page = await doc.getPage(n),
        content = await page.getTextContent(),
        lines = [];
      const items = content.items
        .filter((i) => "str" in i && i.str.trim())
        .sort(
          (a, b) =>
            Math.round(b.transform[5] / 3) - Math.round(a.transform[5] / 3) ||
            a.transform[4] - b.transform[4],
        );
      for (const item of items) {
        const y = Math.round(item.transform[5] / 3),
          last = lines.at(-1);
        if (last && last.y === y) last.text += " " + item.str;
        else lines.push({ y, text: item.str });
      }
      const result = { number: n, lines: lines.map((l) => l.text) };
      await onPage(page, result);
      pages.push(result);
      page.cleanup();
    }
    return pages;
  } finally {
    signal?.removeEventListener("abort", cancel);
    await task.destroy();
  }
}
