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
      "./node_modules/tesseract.js/**",
      "./node_modules/tesseract.js-core/**",
      "./node_modules/.pnpm/tesseract.js@*/**",
      "./node_modules/.pnpm/tesseract.js-core@*/**",
    ],
  },
};

export default nextConfig;
