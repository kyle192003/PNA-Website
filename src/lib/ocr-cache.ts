/**
 * Shared client-side OCR cache + reusable Tesseract worker.
 * Avoids re-downloading the language model and re-scanning the same image.
 */

type OcrKind = "receipt" | "bir2303";

export type OcrScanResult = {
  text: string;
  best: string;
  candidates: string[];
  fromCache: boolean;
};

type CachedPayload = {
  text: string;
  best: string;
  candidates: string[];
};

const MEMORY_CACHE = new Map<string, CachedPayload>();
const SESSION_PREFIX = "pna-ocr-v1:";
const MAX_SESSION_ENTRIES = 24;

type TesseractWorker = {
  recognize: (image: File | string | HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
};

let workerPromise: Promise<TesseractWorker> | null = null;
let workerWarm = false;

async function fileFingerprint(file: File): Promise<string> {
  const sliceSize = Math.min(file.size, 65536);
  const slice = file.slice(0, sliceSize);
  const buffer = await slice.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${file.name}|${file.size}|${file.lastModified}|${file.type}|${hex}`;
}

function cacheKey(kind: OcrKind, fingerprint: string): string {
  return `${kind}:${fingerprint}`;
}

function readSessionCache(key: string): CachedPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedPayload>;
    if (typeof parsed.best !== "string" || !Array.isArray(parsed.candidates)) return null;
    return {
      text: typeof parsed.text === "string" ? parsed.text : "",
      best: parsed.best,
      candidates: parsed.candidates.filter((item): item is string => typeof item === "string"),
    };
  } catch {
    return null;
  }
}

function writeSessionCache(key: string, payload: CachedPayload): void {
  if (typeof window === "undefined") return;
  try {
    const compact: CachedPayload = {
      text: payload.text.slice(0, 8000),
      best: payload.best,
      candidates: payload.candidates.slice(0, 5),
    };
    window.sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(compact));

    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const itemKey = window.sessionStorage.key(i);
      if (itemKey?.startsWith(SESSION_PREFIX)) keys.push(itemKey);
    }
    if (keys.length > MAX_SESSION_ENTRIES) {
      keys
        .slice(0, keys.length - MAX_SESSION_ENTRIES)
        .forEach((oldKey) => window.sessionStorage.removeItem(oldKey));
    }
  } catch {
    // Quota / private mode — memory cache still works.
  }
}

async function getSharedWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = (await createWorker("eng")) as unknown as TesseractWorker;
      workerWarm = true;
      return worker;
    })().catch((error) => {
      workerPromise = null;
      workerWarm = false;
      throw error;
    });
  }
  return workerPromise;
}

/** True after the OCR engine has been loaded once this page session. */
export function isOcrWorkerWarm(): boolean {
  return workerWarm;
}

export async function recognizeImageCached(
  kind: OcrKind,
  file: File,
  extract: (text: string) => { best: string; candidates: string[] }
): Promise<OcrScanResult> {
  if (!file.type.startsWith("image/")) {
    return { text: "", best: "", candidates: [], fromCache: false };
  }

  const fingerprint = await fileFingerprint(file);
  const key = cacheKey(kind, fingerprint);

  const memoryHit = MEMORY_CACHE.get(key);
  if (memoryHit) {
    return { ...memoryHit, fromCache: true };
  }

  const sessionHit = readSessionCache(key);
  if (sessionHit) {
    MEMORY_CACHE.set(key, sessionHit);
    return { ...sessionHit, fromCache: true };
  }

  const worker = await getSharedWorker();
  const {
    data: { text },
  } = await worker.recognize(file);
  const extracted = extract(text);
  const payload: CachedPayload = {
    text,
    best: extracted.best,
    candidates: extracted.candidates,
  };

  MEMORY_CACHE.set(key, payload);
  writeSessionCache(key, payload);

  return { ...payload, fromCache: false };
}
