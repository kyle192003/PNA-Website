/**
 * Client-side BIR Form 2303 OCR helpers (Tesseract.js).
 * Suggests the registered / trade name for sales-invoice receipt naming.
 */

import { recognizeImageCached, type OcrScanResult } from "@/lib/ocr-cache";

const NOISE_LINE =
  /^(certificate|registration|republic|philippines|department|bureau|internal|revenue|bir|form|tin|tax|identification|date|issued|valid|until|address|rdo|region|line|of\s+business|type\s+of)/i;

const NAME_LABEL =
  /(?:registered\s*name|trade\s*name|taxpayer(?:'s)?\s*name|business\s*name|name\s*of\s*(?:taxpayer|registered\s*person|corporation|company)|corporate\s*name)\s*[:\-.]?\s*(.+)/i;

function cleanNameLine(raw: string): string {
  return raw
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;.\-–—]+/, "")
    .replace(/[\s:;.\-–—]+$/, "")
    .trim();
}

function looksLikeName(value: string): boolean {
  if (value.length < 3 || value.length > 120) return false;
  if (NOISE_LINE.test(value)) return false;
  if (/^\d[\d\-\s]{5,}$/.test(value)) return false; // TIN-like
  if (!/[A-Za-z]/.test(value)) return false;
  const letters = (value.match(/[A-Za-z]/g) ?? []).length;
  return letters >= 3;
}

function scoreName(value: string, fromLabel: boolean): number {
  let score = fromLabel ? 50 : 0;
  if (
    /\b(inc|corp|corporation|company|co\.|ltd|llc|hospital|university|clinic|school|foundation)\b/i.test(
      value
    )
  ) {
    score += 20;
  }
  if (value === value.toUpperCase() && value.length >= 8) score += 8;
  if (value.split(" ").length >= 2) score += 6;
  if (/\d{5,}/.test(value)) score -= 15;
  return score;
}

/** Pull the most likely institution / company name from BIR 2303 OCR text. */
export function extractBir2303InstitutionName(ocrText: string): {
  best: string;
  candidates: string[];
} {
  const scored = new Map<string, number>();
  const lines = ocrText
    .split(/\r?\n/)
    .map((line) => cleanNameLine(line))
    .filter(Boolean);

  for (const line of lines) {
    const labeled = line.match(NAME_LABEL);
    if (labeled?.[1]) {
      const cleaned = cleanNameLine(labeled[1]);
      if (looksLikeName(cleaned)) {
        scored.set(cleaned, Math.max(scored.get(cleaned) ?? 0, scoreName(cleaned, true)));
      }
    }
  }

  // Fallback: strong business-looking lines near the top half of the document.
  const topHalf = lines.slice(0, Math.max(8, Math.ceil(lines.length * 0.55)));
  for (const line of topHalf) {
    if (!looksLikeName(line)) continue;
    if (NAME_LABEL.test(line)) continue;
    scored.set(line, Math.max(scored.get(line) ?? 0, scoreName(line, false)));
  }

  const candidates = [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value)
    .slice(0, 5);

  return { best: candidates[0] ?? "", candidates };
}

export async function scanBir2303Image(file: File): Promise<OcrScanResult> {
  return recognizeImageCached("bir2303", file, extractBir2303InstitutionName);
}
