import { promises as fs } from "fs";
import path from "path";
import { get, put } from "@vercel/blob";

const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const TMP_DATA_DIR = path.join("/tmp", "pna-data");

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/** Must match the Vercel Blob store access mode (public vs private). */
function getBlobAccess(): "public" | "private" {
  const configured = process.env.BLOB_STORE_ACCESS?.trim().toLowerCase();
  if (configured === "private" || configured === "public") {
    return configured;
  }
  // Default public — matches typical Vercel Blob stores and uploads.ts.
  return "public";
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
  try {
    if (hasBlobToken()) {
      const fromBlob = await readBlobJson(filename);
      if (fromBlob) return JSON.parse(fromBlob) as T;

      const seed =
        (await readLocalJsonFile(localPath(filename))) ??
        (isVercelRuntime() ? await readLocalJsonFile(tmpPath(filename)) : null);

      if (seed) {
        try {
          await writeBlobJson(filename, seed);
        } catch (error) {
          console.error(`[json-store] failed seeding blob for ${filename}:`, error);
        }
        return JSON.parse(seed) as T;
      }
    }

    if (isVercelRuntime()) {
      const fromTmp = await readLocalJsonFile(tmpPath(filename));
      if (fromTmp) return JSON.parse(fromTmp) as T;
    }

    const fromLocal = await readLocalJsonFile(localPath(filename));
    if (fromLocal) return JSON.parse(fromLocal) as T;
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
