import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as mupdf from "mupdf";

interface ExtractedData {
  [key: string]: string | undefined;
}

/**
 * Run system tesseract on a PNG file. Returns full text.
 */
function ocrImage(imagePath: string): string {
  try {
    const outBase = imagePath.replace(/\.\w+$/, "_out");
    execSync(`tesseract "${imagePath}" "${outBase}" --psm 3 2>/dev/null`, {
      timeout: 15000,
    });
    const text = readFileSync(outBase + ".txt", "utf8");
    try { unlinkSync(outBase + ".txt"); } catch {}
    return text;
  } catch {
    return "";
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
  const tmp = mkdtempSync(join(tmpdir(), "ocr-"));

  try {
    // Step 1: Render PDF to high-res PNG
    let imagePath: string;
    if (mimeType.includes("pdf")) {
      const doc = mupdf.Document.openDocument(fileBuffer, "application/pdf");
      const page = doc.loadPage(0);
      const pixmap = page.toPixmap(
        mupdf.Matrix.scale(3, 3),
        mupdf.ColorSpace.DeviceRGB
      );
      imagePath = join(tmp, "page.png");
      writeFileSync(imagePath, Buffer.from(pixmap.asPNG()));
    } else {
      imagePath = join(tmp, "page.png");
      writeFileSync(imagePath, fileBuffer);
    }

    // Step 2: Full-page OCR
    const fullText = ocrImage(imagePath);
    if (!fullText.trim()) {
      return {};
    }

    // Step 3: Parse the structured text
    const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
    const results: ExtractedData = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1] || "";

      // Clean the line for matching — remove OCR artifacts like | ] etc
      const cleanLine = line.replace(/[|[\]{}]/g, "").replace(/\s+/g, " ").trim();

      // "Name of Customer" label → next line is the name
      if (/name\s+of\s+customer/i.test(cleanLine)) {
        const name = clean(nextLine);
        if (name && !/street\s+address/i.test(name)) {
          results.customer_name = name;
        }
      }

      // "Street Address" label → next line is the address
      if (/street\s+address/i.test(cleanLine)) {
        const addr = clean(nextLine);
        if (addr && !/^city/i.test(addr)) {
          results.address = addr;
        }
      }

      // "City State Zip Code Phone" label line (with OCR variations)
      // Sometimes OCR only picks up "City State" without "Zip Code Phone"
      if (/c\w{0,3}y?\s+state/i.test(cleanLine) && !/united/i.test(cleanLine)) {
        // The next line has the actual values: "Bronx NY 10453 (347) 912-8806"
        // Or sometimes just "MANHATTAN" if zip/phone are missing or on another line
        const dataLine = clean(nextLine);
        if (dataLine && !/vendor/i.test(dataLine)) {
          // Check if the line after that also has data (sometimes split across 2 lines)
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
  } finally {
    try { execSync(`rm -rf "${tmp}"`); } catch {}
  }
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
