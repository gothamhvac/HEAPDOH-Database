// Parse a NY State of Health "EPCP Vendor Assignment Notice" running sheet PDF.
// Uses mupdf to read positional text, then groups lines into rows by y-coordinate.
// Coordinates returned are in mupdf's top-left origin (PDF points).

import * as mupdf from "mupdf";

export interface ParsedRow {
  consumerName: string;        // e.g. "First L." (asterisk stripped)
  applicationId: string;       // e.g. 5-digit number
  assignmentDate: string | null; // ISO date or null
  paperMail: boolean;          // leading-asterisk consumers
  pageIndex: number;           // 0-based page
  rowY: number;                // mupdf top-left-origin y of the row
}

export interface ParsedSheet {
  vendorName: string | null;
  sheetDate: string | null;    // ISO date or null
  pageCount: number;
  pageHeight: number;          // first-page height (PDF points)
  rows: ParsedRow[];
}

interface Line {
  text: string;
  x: number;
  y: number;
  page: number;
}

const APP_ID_RE = /^\d{4,7}$/;
const DATE_RE = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/;
const SLASH_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const DATE_OF_NOTICE_RE = /Date of Notice:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i;
const VENDOR_NAME_RE = /Vendor Name:\s*(.+?)(?:\s*$)/i;

function parseHumanDate(s: string): string | null {
  if (!s) return null;
  const m = s.match(SLASH_DATE_RE);
  if (m) {
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // "April 27, 2026"
  const t = s.replace(/,/g, "").trim();
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

// Pull all (text, x, y, page) tuples out of a mupdf document by walking its
// structured text blocks/lines.
function collectLines(doc: mupdf.PDFDocument): { lines: Line[]; pageHeight: number; pageCount: number } {
  const lines: Line[] = [];
  const pageCount = doc.countPages();
  let pageHeight = 0;

  for (let p = 0; p < pageCount; p++) {
    const page = doc.loadPage(p);
    const bbox = page.getBounds();
    const h = bbox[3] - bbox[1];
    if (p === 0) pageHeight = h;

    const stext = page.toStructuredText("preserve-whitespace");
    const json = JSON.parse(stext.asJSON());

    for (const block of json.blocks || []) {
      if (block.type !== "text") continue;
      for (const line of block.lines || []) {
        const text = (line.text ?? (line.spans || []).map((s: { text?: string }) => s.text || "").join("")) as string;
        if (!text || !text.trim()) continue;
        const lb = line.bbox || block.bbox;
        if (!lb) continue;
        lines.push({
          text: text.trim(),
          x: lb.x,
          y: lb.y,
          page: p,
        });
      }
    }
  }

  return { lines, pageHeight, pageCount };
}

// Bucket lines by approximate y-coordinate so multi-fragment rows recombine.
function groupRowsByY(lines: Line[], tolerance = 4): Line[][] {
  const sorted = [...lines].sort((a, b) => (a.page - b.page) * 1e6 + (a.y - b.y));
  const groups: Line[][] = [];
  for (const ln of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[0].page === ln.page && Math.abs(last[0].y - ln.y) <= tolerance) {
      last.push(ln);
    } else {
      groups.push([ln]);
    }
  }
  return groups.map((g) => g.sort((a, b) => a.x - b.x));
}

export function parseRunningSheet(pdfBytes: Uint8Array): ParsedSheet {
  const doc = mupdf.PDFDocument.openDocument(pdfBytes, "application/pdf");
  const { lines, pageHeight, pageCount } = collectLines(doc as mupdf.PDFDocument);

  // ─── Header info ───
  let sheetDate: string | null = null;
  let vendorName: string | null = null;
  for (const ln of lines) {
    if (!sheetDate) {
      const m = ln.text.match(DATE_OF_NOTICE_RE);
      if (m) sheetDate = parseHumanDate(m[1]);
    }
    if (!vendorName) {
      const m = ln.text.match(VENDOR_NAME_RE);
      if (m) vendorName = m[1].trim();
    }
  }

  // ─── Locate the table ───
  // Find the row that contains the column headers. Each header word may be a
  // separate fragment, so find ANY line containing "Application ID" then take
  // its y as the table-header y.
  const rows = groupRowsByY(lines);
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].map((l) => l.text).join(" ");
    if (/Application ID/i.test(joined) && /Consumer Name/i.test(joined)) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    // Couldn't find header — bail with empty rows.
    return { vendorName, sheetDate, pageCount, pageHeight, rows: [] };
  }

  // ─── Parse data rows ───
  // For each row after the header, find an Application ID fragment. If found,
  // the row is a data row: name = fragments to the left of app_id (joined),
  // date = fragments to the right matching a date pattern.
  const out: ParsedRow[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const appIdLine = row.find((l) => APP_ID_RE.test(l.text));
    if (!appIdLine) continue;

    const left = row.filter((l) => l.x < appIdLine.x);
    const right = row.filter((l) => l.x > appIdLine.x);

    const nameRaw = left.map((l) => l.text).join(" ").trim();
    const paperMail = nameRaw.startsWith("*");
    const consumerName = nameRaw.replace(/^\*\s*/, "").trim();
    if (!consumerName) continue;

    const dateLine = right.find((l) => DATE_RE.test(l.text)) || right[0];
    const assignmentDate = dateLine ? parseHumanDate(dateLine.text) : null;

    out.push({
      consumerName,
      applicationId: appIdLine.text,
      assignmentDate,
      paperMail,
      pageIndex: appIdLine.page,
      rowY: appIdLine.y,
    });
  }

  return { vendorName, sheetDate, pageCount, pageHeight, rows: out };
}
