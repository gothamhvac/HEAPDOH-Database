import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both packages load WASM and worker scripts from disk at runtime —
  // Next's webpack bundling breaks those resolutions, so opt them out.
  serverExternalPackages: ["tesseract.js", "mupdf"],
};

export default nextConfig;
