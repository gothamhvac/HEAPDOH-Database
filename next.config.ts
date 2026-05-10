import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mupdf has WASM loaded from disk at runtime — Next's webpack bundling
  // breaks the resolution, so opt it out. (tesseract.js used to be here
  // too but OCR runs in the browser now.)
  serverExternalPackages: ["mupdf"],
};

export default nextConfig;
