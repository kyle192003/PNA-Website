/**
 * Client-side receipt OCR helpers (Tesseract.js).
 * Used to suggest a payment / transfer reference from an uploaded proof image.
 */

import { recognizeImageCached, type OcrScanResult } from "@/lib/ocr-cache";

const REFERENCE_LABEL =
  /(?:ref(?:erence)?(?:\s*(?:no\.?|number|#))?|txn(?:\s*(?:no\.?|id))?|transaction(?:\s*(?:no\.?|id|ref))?|trace\s*(?:no\.?|number)?|control\s*(?:no\.?)?|confirmation(?:\s*(?:no\.?|code))?)\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9\- ]{5,28})/gi;

const STANDALONE_CODE = /\b([A-Z0-9]{4,}(?:[- ]?[A-Z0-9]{3,}){1,5})\b/g;
const LONG_DIGITS = /\b(\d{8,20})\b/g;

function cleanCandidate(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().replace(/[^\w\- ]/g, "").trim();
}

function scoreCandidate(value: string, fromLabel: boolean): number {
  let score = fromLabel ? 40 : 0;
  if (/^\d+$/.test(value.replace(/[\s\-]/g, ""))) score += 15;
  if (value.length >= 8 && value.length <= 24) score += 10;
  if (/[A-Z]/i.test(value) && /\d/.test(value)) score += 12;
  if (/^PNA-/i.test(value)) score -= 30; // registration refs are not payment refs
  return score;
}

/** Pull the most likely payment/transfer reference from OCR text. */
export function extractPaymentReference(ocrText: string): {
  best: string;
  candidates: string[];
} {
  const scored = new Map<string, number>();

  for (const match of ocrText.matchAll(REFERENCE_LABEL)) {
    const cleaned = cleanCandidate(match[1] ?? "");
    if (cleaned.length < 6) continue;
    scored.set(cleaned, Math.max(scored.get(cleaned) ?? 0, scoreCandidate(cleaned, true)));
  }

  for (const match of ocrText.matchAll(STANDALONE_CODE)) {
    const cleaned = cleanCandidate(match[1] ?? "");
    if (cleaned.length < 8) continue;
    scored.set(cleaned, Math.max(scored.get(cleaned) ?? 0, scoreCandidate(cleaned, false)));
  }

  for (const match of ocrText.matchAll(LONG_DIGITS)) {
    const cleaned = cleanCandidate(match[1] ?? "");
    if (cleaned.length < 8) continue;
    scored.set(cleaned, Math.max(scored.get(cleaned) ?? 0, scoreCandidate(cleaned, false) + 5));
  }

  const candidates = [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value)
    .slice(0, 5);

  return { best: candidates[0] ?? "", candidates };
}

export async function scanReceiptImage(file: File): Promise<OcrScanResult> {
  return recognizeImageCached("receipt", file, extractPaymentReference);
}
