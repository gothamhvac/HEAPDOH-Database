import * as mupdf from "mupdf";
import { createWorker } from "tesseract.js";

interface ExtractedData {
  [key: string]: string | undefined;
}

// Run tesseract.js (WASM) on a PNG buffer. Works in serverless runtimes
// where the system `tesseract` binary isn't installed.
async function ocrPng(pngBuffer: Buffer): Promise<string> {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(pngBuffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Clean OCR artifacts from a string
 */
function clean(text: string): string {
  return text
    .replace(/[|"'"'«»\u201c\u201d\u2018\u2019`]/g, "")
    .replace(/[\u2014\u2013]/g, "")
    .replace(/-{2,}/g, "")
    .replace(/(?<![a-zA-Z0-9])-/g, "")
    .replace(/-(?![a-zA-Z0-9])/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract customer fields from a HEAP invoice using full-page OCR
 * then parsing the known label structure.
 *
 * HEAP invoices (LDSS-5044) all have the same labels:
 *   "Name of Customer" → next line is the name
 *   "Street Address" → next line is the address
 *   "City" → followed by State, Zip Code, Phone on the same label line
 *   Next line has the actual city, state, zip, phone values
 *
 * This approach is invoice-layout-independent — works on any LDSS-5044.
 */
export async function extractFromInvoice(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ExtractedData> {
  // Step 1: Render PDF page 1 to high-res PNG (or use the image as-is)
  let pngBuffer: Buffer;
  if (mimeType.includes("pdf")) {
    const doc = mupdf.Document.openDocument(fileBuffer, "application/pdf");
    const page = doc.loadPage(0);
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(3, 3),
      mupdf.ColorSpace.DeviceRGB
    );
    pngBuffer = Buffer.from(pixmap.asPNG());
  } else {
    pngBuffer = fileBuffer;
  }

  // Step 2: Full-page OCR
  const fullText = await ocrPng(pngBuffer);
  if (!fullText.trim()) {
    return {};
  }

  // Step 3: Parse the structured text
  const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
  const results: ExtractedData = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";

    const cleanLine = line.replace(/[|[\]{}]/g, "").replace(/\s+/g, " ").trim();

    if (/name\s+of\s+customer/i.test(cleanLine)) {
      const name = clean(nextLine);
      if (name && !/street\s+address/i.test(name)) {
        results.customer_name = name;
      }
    }

    if (/street\s+address/i.test(cleanLine)) {
      const addr = clean(nextLine);
      if (addr && !/^city/i.test(addr)) {
        results.address = addr;
      }
    }

    // "City State Zip Code Phone" label — sometimes OCR truncates to "City State"
    if (/c\w{0,3}y?\s+state/i.test(cleanLine) && !/united/i.test(cleanLine)) {
      const dataLine = clean(nextLine);
      if (dataLine && !/vendor/i.test(dataLine)) {
        const nextNext = lines[i + 2] ? clean(lines[i + 2]) : "";
        const combined = nextNext && !/vendor/i.test(nextNext) && !/section/i.test(nextNext)
          ? dataLine + " " + nextNext
          : dataLine;
        const parsed = parseCityStateZipPhone(combined);
        if (parsed.city) results.city = parsed.city;
        if (parsed.state) results.state = parsed.state;
        if (parsed.zip) results.zip_code = parsed.zip;
        if (parsed.phone) results.phone_number = parsed.phone;
      }
    }
  }

  return results;
}

/**
 * Parse a line like "Bronx NY 10453 (347) 912-8806"
 * or "MANHATTAN NY 10025 (332) 281-3567"
 */
function parseCityStateZipPhone(line: string): {
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
} {
  // Extract phone number(s) — handles (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx xxx xxxx
  const phoneRegex = /\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/;
  const phoneMatch = line.match(phoneRegex);
  const phone = phoneMatch ? phoneMatch[0] : undefined;

  // Remove all phone numbers from line to parse city/state/zip
  let remaining = line.replace(phoneRegex, "").trim();
  const phone2Match = remaining.match(phoneRegex);
  if (phone2Match) remaining = remaining.replace(phone2Match[0], "").trim();

  // Extract zip — 5 digits
  const zipMatch = remaining.match(/\b(\d{5})\b/);
  const zip = zipMatch ? zipMatch[1] : undefined;
  if (zipMatch) remaining = remaining.replace(zipMatch[0], "").trim();

  // Extract state — 2 uppercase letters
  const stateMatch = remaining.match(/\b([A-Z]{2})\b/);
  const state = stateMatch ? stateMatch[1] : undefined;
  if (stateMatch) remaining = remaining.replace(stateMatch[0], "").trim();

  // Whatever's left is the city — clean up stray single chars and digits
  const city = remaining
    .replace(/\b[a-z0-9]\b/gi, "")  // remove single stray characters
    .replace(/^\d+\s+/, "")          // remove leading digits
    .replace(/[\s,]+/g, " ")
    .trim() || undefined;

  return { city, state, zip, phone };
}

/**
 * Map extracted data to customer DB fields. Splits any apartment/unit code
 * baked into the OCR'd street into a separate line2 so the geocoder can
 * resolve the street cleanly.
 */
import { extractApartment } from "@/lib/address-utils";

export function mapToCustomerData(extracted: ExtractedData) {
  const { street, unit } = extractApartment(extracted.address || "");
  return {
    full_name: extracted.customer_name || null,
    address_line1: street || null,
    address_line2: unit,
    city: extracted.city || null,
    state: extracted.state || null,
    zip: extracted.zip_code || null,
    phone_primary: extracted.phone_number || null,
  };
}
