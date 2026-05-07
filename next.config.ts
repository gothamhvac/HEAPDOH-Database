import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both packages load WASM and worker scripts from disk at runtime —
  // Next's webpack bundling breaks those resolutions, so opt them out.
  serverExternalPackages: ["tesseract.js", "mupdf"],

  // Bundle the tesseract language data with the OCR function so it's
  // available on disk at runtime instead of being fetched from a CDN
  // (the default behavior hangs on Vercel).
  outputFileTracingIncludes: {
    "/api/ocr": ["./public/tessdata/eng.traineddata.gz"],
  },
};

export default nextConfig;
