import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { get, put } from "@vercel/blob";
import { toPlainData } from "@/lib/security/safe-input";
import { getBlobReadWriteToken, getBlobStoreAccess } from "@/lib/security/server-env";

const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const TMP_DATA_DIR = path.join("/tmp", "pna-data");
const SAFE_JSON_DOCUMENT = /^[a-z0-9][a-z0-9._-]*\.json$/i;

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

/** Must match the Vercel Blob store access mode (public vs private). */
function getBlobAccess(): "public" | "private" {
  return getBlobStoreAccess();
}

function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
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
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not configured. Add a Vercel Blob store so event data can be saved in production."
    );
  }

  await put(blobPathname(filename), contents, {
    access: getBlobAccess(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

/**
 * Read JSON from durable storage.
 * Priority: Vercel Blob → writable tmp (Vercel) → local data/ (dev / bundled seed).
 * When Blob is configured but empty, seed it from the bundled local file once.
 */
export async function readJsonDocument<T>(
  filename: string,
  fallback: T
): Promise<T> {
  assertSafeDocumentName(filename);
  try {
    if (hasBlobToken()) {
      const fromBlob = await readBlobJson(filename);
      if (fromBlob) return parseJsonDocument<T>(fromBlob);

      const seed =
        (await readLocalJsonFile(localPath(filename))) ??
        (isVercelRuntime() ? await readLocalJsonFile(tmpPath(filename)) : null);

      if (seed) {
        try {
          await writeBlobJson(filename, seed);
        } catch (error) {
          console.error(`[json-store] failed seeding blob for ${filename}:`, error);
        }
        return parseJsonDocument<T>(seed);
      }
    }

    if (isVercelRuntime()) {
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
 * Uses Blob when configured; otherwise local disk in development,
 * or /tmp on Vercel (ephemeral — configure Blob for durable production writes).
 */
export async function writeJsonDocument<T>(filename: string, value: T): Promise<void> {
  assertSafeDocumentName(filename);
  const contents = `${JSON.stringify(value, null, 2)}\n`;

  if (hasBlobToken()) {
    await writeBlobJson(filename, contents);
    // Keep a warm tmp copy for faster subsequent reads in this instance.
    if (isVercelRuntime()) {
      try {
        await writeLocalJsonFile(tmpPath(filename), contents);
      } catch {
        // ignore tmp mirror failures
      }
    }
    return;
  }

  if (isVercelRuntime()) {
    try {
      await writeLocalJsonFile(tmpPath(filename), contents);
      console.warn(
        `[json-store] Wrote ${filename} to /tmp only. Configure BLOB_READ_WRITE_TOKEN for durable storage.`
      );
      return;
    } catch (error) {
      throw new Error(
        `Cannot save ${filename} on this serverless host (read-only filesystem). Configure a Vercel Blob store (BLOB_READ_WRITE_TOKEN).`
      );
    }
  }

  await writeLocalJsonFile(localPath(filename), contents);
}

export async function ensureJsonDocument<T>(
  filename: string,
  fallback: T
): Promise<T> {
  const existing = await readJsonDocument<T | null>(filename, null);
  if (existing !== null) return existing;
  await writeJsonDocument(filename, fallback);
  return fallback;
}
