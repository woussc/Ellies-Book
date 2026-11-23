import type { PDFPageProxy } from "pdfjs-dist";
export function readStatementPdf(
  data: ArrayBuffer | Uint8Array,
  options?: {
    password?: (wrong: boolean) => Promise<string | null>;
    signal?: AbortSignal;
    assets?: string;
    onPage?: (
      page: PDFPageProxy,
      result: { number: number; lines: string[] },
    ) => Promise<void>;
  },
): Promise<{ number: number; lines: string[] }[]>;
