// Pure text-parser for HEAP LDSS-5044 invoice OCR output. Runs in both
// the browser (post-OCR) and server (just in case). No image processing,
// no native deps.

import { extractApartment } from "@/lib/address-utils";

export interface ExtractedData {
  [key: string]: string | undefined;
}

function clean(text: string): string {
  return text
    .replace(/[|"'"'«»“”‘’`]/g, "")
    .replace(/[—–]/g, "")
    .replace(/-{2,}/g, "")
    .replace(/(?<![a-zA-Z0-9])-/g, "")
    .replace(/-(?![a-zA-Z0-9])/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCityStateZipPhone(line: string): {
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
} {
  const phoneRegex = /\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/;
  const phoneMatch = line.match(phoneRegex);
  const phone = phoneMatch ? phoneMatch[0] : undefined;

  let remaining = line.replace(phoneRegex, "").trim();
  const phone2Match = remaining.match(phoneRegex);
  if (phone2Match) remaining = remaining.replace(phone2Match[0], "").trim();

  const zipMatch = remaining.match(/\b(\d{5})\b/);
  const zip = zipMatch ? zipMatch[1] : undefined;
  if (zipMatch) remaining = remaining.replace(zipMatch[0], "").trim();

  const stateMatch = remaining.match(/\b([A-Z]{2})\b/);
  const state = stateMatch ? stateMatch[1] : undefined;
  if (stateMatch) remaining = remaining.replace(stateMatch[0], "").trim();

  const city = remaining
    .replace(/\b[a-z0-9]\b/gi, "")
    .replace(/^\d+\s+/, "")
    .replace(/[\s,]+/g, " ")
    .trim() || undefined;

  return { city, state, zip, phone };
}

// LDSS-5044 invoices have a known label structure:
//   "Name of Customer" → next line is the name
//   "Street Address"   → next line is the address
//   "City State Zip Code Phone" → next line(s) have the values
export function parseInvoiceText(fullText: string): ExtractedData {
  if (!fullText.trim()) return {};

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
