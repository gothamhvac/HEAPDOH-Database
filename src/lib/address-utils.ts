// Pure helpers for splitting NYC street addresses into a clean street line
// and an apartment/unit line. Used by:
//   - the route planner (geocoder uses only the street part)
//   - the customer edit form (auto-prefills line2 when line1 has an apt)
//   - the HEAP OCR extractor (writes line2 separately)
//   - the bulk-tidy endpoint (one-shot backfill of historical records)

// Add ordinal suffix to a number ("83 Street" → "83rd Street").
export function ordinalize(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// Add ordinal suffix to numeric NYC street names. Skips ones that already
// have an ordinal like "169th".
export function ordinalizeStreets(s: string): string {
  return s.replace(
    /\b(\d+)\s+(Street|Avenue|Drive|Place|Road|Lane|Court|Boulevard|Blvd|St|Ave|Rd|Dr|Pl|Ln|Ct)\b/gi,
    (_, n: string, w: string) => `${ordinalize(parseInt(n, 10))} ${w}`,
  );
}

interface SplitAddress {
  street: string;
  unit: string | null;
}

// Split an address string into a clean street line and an apartment/unit.
// Returns { street, unit }. Designed to be safe to apply to already-clean
// addresses (returns the input as `street` with `unit: null`).
export function extractApartment(input: string): SplitAddress {
  if (!input) return { street: "", unit: null };
  let street = input.trim();
  const collected: string[] = [];

  function pull(re: RegExp) {
    street = street.replace(re, (match) => {
      collected.push(match.trim().replace(/^,\s*/, ""));
      return "";
    });
  }

  // 1. Ordinal-floor: "1st Floor", "2nd Fl"
  pull(/\s*,?\s*\d+(?:st|nd|rd|th)\s+(?:floor|fl)\b\.?/gi);
  // 2. Word-floor: "ground floor", "first floor", "top floor"
  pull(/\s*,?\s*(?:ground|basement|cellar|main|first|second|third|top)\s+(?:floor|fl)\b\.?/gi);
  // 3. Keyword apartments: "Apt 4B", "Unit 2", "Suite 100"
  pull(/\s*,?\s*\b(?:apartment|apt|unit|suite|ste|fl|floor|room|rm)\.?\s*\S*/gi);
  // 4. # designators: "#5", "# 5B"
  pull(/\s*,?\s*#\s*\S+/g);
  // 5. Bare trailing apt code at end: "4L", "12B", "PH", "GR"
  pull(/\s*,?\s+(?:\d{1,3}[A-Z]|PH|GR)\s*$/i);

  street = street.replace(/\s+/g, " ").replace(/^,|,$|\s,/g, "").trim();
  street = ordinalizeStreets(street);

  const unit = collected
    .map((u) => u.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return { street, unit: unit || null };
}

// Convenience for the route geocoder where we only need the street.
export function cleanStreetAddress(input: string): string {
  return extractApartment(input).street;
}
