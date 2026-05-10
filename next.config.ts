import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both packages load WASM and worker scripts from disk at runtime —
  // Next's webpack bundling breaks those resolutions, so opt them out.
  serverExternalPackages: ["tesseract.js", "mupdf"],

  // Bundle the tesseract language data with the OCR function so it's
  // available on disk at runtime instead of being fetched from a CDN
  // (the default behavior hangs on Vercel).
  // Also force-include the tesseract.js worker scripts and core — the
  // tracer doesn't follow worker_threads child paths, so the dynamic
  // require('worker-script/index.js') from the worker child fails
  // unless we tell Vercel to ship those files explicitly.
  outputFileTracingIncludes: {
    "/api/ocr": [
      "./public/tessdata/eng.traineddata.gz",

      // tesseract.js source + worker scripts (pnpm-virtual-store path)
      "./node_modules/.pnpm/tesseract.js@*/node_modules/tesseract.js/src/**",
      "./node_modules/.pnpm/tesseract.js@*/node_modules/tesseract.js/package.json",

      // tesseract.js-core: ship ONLY the LSTM variants since we run with
      // oem=1 (LSTM_ONLY). Skipping the legacy + combined variants keeps
      // the function under Vercel's 250 MB unzipped cap.
      "./node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/tesseract-core-lstm.*",
      "./node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/tesseract-core-simd-lstm.*",
      "./node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/index.js",
      "./node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/package.json",
    ],
  },
};

export default nextConfig;
