// Browser-side OCR. Renders the first page of a PDF (or accepts an image
// directly) and runs tesseract.js against it. Returns the parsed customer
// fields ready to send to the server.
//
// We do this client-side because Vercel's serverless function bundler
// can't ship tesseract.js's worker_threads child scripts intact (the
// tracer misses transitive requires inside the worker). The user's
// browser has tesseract.js's deps resolved naturally and unlimited
// runtime — no cold-start cap.

import { parseInvoiceText, mapToCustomerData, type ExtractedData } from "./parse";

const PDF_RENDER_SCALE = 3; // matches the prior mupdf 3x scale

async function renderPdfFirstPageToBlob(file: File): Promise<Blob> {
  // Dynamic import keeps pdfjs out of any other client bundle.
  const pdfjs = await import("pdfjs-dist");
  // Use a CDN worker so we don't have to bundle one ourselves.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const arrayBuf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: arrayBuf }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas → Blob failed"))), "image/png");
  });
}

export interface BrowserOcrResult {
  extracted: ExtractedData;
  customerData: ReturnType<typeof mapToCustomerData>;
  rawText: string;
}

export async function ocrInvoiceInBrowser(file: File): Promise<BrowserOcrResult> {
  // 1. Get a PNG blob — render the PDF, or use the image as-is.
  const imageBlob = file.type.includes("pdf")
    ? await renderPdfFirstPageToBlob(file)
    : file;

  // 2. Run tesseract.
  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker("eng");
  try {
    const { data } = await worker.recognize(imageBlob);
    const extracted = parseInvoiceText(data.text);
    return {
      extracted,
      customerData: mapToCustomerData(extracted),
      rawText: data.text,
    };
  } finally {
    await worker.terminate();
  }
}
