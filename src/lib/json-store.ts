import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { get, put } from "@vercel/blob";
import { toPlainData } from "@/lib/security/safe-input";
import {
  getBlobReadWriteToken,
  getBlobStoreAccess,
  isServerlessRuntime,
  isSupabaseConfigured,
} from "@/lib/security/server-env";
import { getSupabaseAdmin, requireSupabaseAdmin } from "@/lib/supabase/admin";

const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const TMP_DATA_DIR = path.join("/tmp", "pna-data");
const SAFE_JSON_DOCUMENT = /^[a-z0-9][a-z0-9._-]*\.json$/i;
const APP_DOCUMENTS_TABLE = "app_documents";

function parseJsonDocument<T>(raw: string): T {
  return toPlainData(JSON.parse(raw)) as T;
}

function assertSafeDocumentName(filename: string): void {
  if (
    !SAFE_JSON_DOCUMENT.test(filename) ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    throw new Error("Invalid JSON document name.");
  }
}

function hasBlobToken(): boolean {
  return Boolean(getBlobReadWriteToken());
}

function getBlobAccess(): "public" | "private" {
  return getBlobStoreAccess();
}

function localPath(filename: string): string {
  return path.join(LOCAL_DATA_DIR, filename);
}

function tmpPath(filename: string): string {
  return path.join(TMP_DATA_DIR, filename);
}

function blobPathname(filename: string): string {
  return `data/${filename.replace(/^\/+/, "")}`;
}

async function readLocalJsonFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function writeLocalJsonFile(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf-8");
}

async function readSupabaseJson(filename: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(APP_DOCUMENTS_TABLE)
    .select("payload")
    .eq("name", filename)
    .maybeSingle();

  if (error) {
    console.error(`[json-store] supabase read ${filename}:`, error.message);
    return null;
  }
  if (data?.payload == null) return null;
  return JSON.stringify(data.payload);
}

async function writeSupabaseJson(filename: string, value: unknown): Promise<void> {
  const supabase = requireSupabaseAdmin();
  const payload = JSON.parse(JSON.stringify(toPlainData(value)));
  const { error } = await supabase.from(APP_DOCUMENTS_TABLE).upsert(
    {
      name: filename,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "name" }
  );
  if (error) {
    const hint =
      /invalid path/i.test(error.message)
        ? " Check NEXT_PUBLIC_SUPABASE_URL — use only https://YOUR-PROJECT.supabase.co (no /rest/v1)."
        : "";
    throw new Error(`Could not save ${filename}: ${error.message}.${hint}`);
  }
}

async function readBlobJson(filename: string): Promise<string | null> {
  if (!hasBlobToken()) return null;

  const pathname = blobPathname(filename);
  const access = getBlobAccess();
  const fallbackAccess = access === "public" ? "private" : "public";

  try {
    const blob = await get(pathname, { access });
    if (blob?.stream) {
      return new Response(blob.stream).text();
    }
  } catch {
    // Try the opposite access mode for resilience to config drift.
  }

  try {
    const blob = await get(pathname, { access: fallbackAccess });
    if (blob?.stream) {
      return new Response(blob.stream).text();
    }
  } catch {
    // Not found or inaccessible in both modes.
  }

  return null;
}

async function writeBlobJson(filename: string, contents: string): Promise<void> {
  if (!hasBlobToken()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  await put(blobPathname(filename), contents, {
    access: getBlobAccess(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

async function readSeedJson(filename: string): Promise<string | null> {
  return (
    (await readLocalJsonFile(localPath(filename))) ??
    (isServerlessRuntime() ? await readLocalJsonFile(tmpPath(filename)) : null)
  );
}

/**
 * Read JSON from durable storage.
 * Priority: Supabase → Vercel Blob → local data/ (dev / bundled seed).
 * When a remote store is empty, seed it from the bundled local file once.
 */
export async function readJsonDocument<T>(filename: string, fallback: T): Promise<T> {
  assertSafeDocumentName(filename);
  try {
    if (isSupabaseConfigured()) {
      const fromSupabase = await readSupabaseJson(filename);
      if (fromSupabase) return parseJsonDocument<T>(fromSupabase);

      const seed = await readSeedJson(filename);
      if (seed) {
        try {
          await writeSupabaseJson(filename, parseJsonDocument(seed));
        } catch (error) {
          console.error(`[json-store] failed seeding supabase for ${filename}:`, error);
        }
        return parseJsonDocument<T>(seed);
      }
      return fallback;
    }

    if (hasBlobToken()) {
      const fromBlob = await readBlobJson(filename);
      if (fromBlob) return parseJsonDocument<T>(fromBlob);

      const seed = await readSeedJson(filename);
      if (seed) {
        try {
          await writeBlobJson(filename, seed);
        } catch (error) {
          console.error(`[json-store] failed seeding blob for ${filename}:`, error);
        }
        return parseJsonDocument<T>(seed);
      }
    }

    if (isServerlessRuntime()) {
      const fromTmp = await readLocalJsonFile(tmpPath(filename));
      if (fromTmp) return parseJsonDocument<T>(fromTmp);
    }

    const fromLocal = await readLocalJsonFile(localPath(filename));
    if (fromLocal) return parseJsonDocument<T>(fromLocal);
  } catch (error) {
    console.error(`[json-store] failed reading ${filename}:`, error);
  }

  return fallback;
}

/**
 * Persist JSON so admin updates survive on Vercel.
 * Uses Supabase when configured, then Blob, then local disk in development.
 */
export async function writeJsonDocument<T>(filename: string, value: T): Promise<void> {
  assertSafeDocumentName(filename);
  const plain = toPlainData(value);
  const contents = `${JSON.stringify(plain, null, 2)}\n`;

  if (isSupabaseConfigured()) {
    await writeSupabaseJson(filename, plain);
    return;
  }

  if (hasBlobToken()) {
    await writeBlobJson(filename, contents);
    if (isServerlessRuntime()) {
      try {
        await writeLocalJsonFile(tmpPath(filename), contents);
      } catch {
        // ignore tmp mirror failures
      }
    }
    return;
  }

  if (isServerlessRuntime()) {
    throw new Error(
      `Cannot save ${filename} on Vercel without Supabase. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`
    );
  }

  await writeLocalJsonFile(localPath(filename), contents);
}

export async function ensureJsonDocument<T>(filename: string, fallback: T): Promise<T> {
  const existing = await readJsonDocument<T | null>(filename, null);
  if (existing !== null) return existing;
  await writeJsonDocument(filename, fallback);
  return fallback;
}
