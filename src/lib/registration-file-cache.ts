/**
 * Short-lived IndexedDB cache for registration upload files.
 * Survives refresh / tab discard temporarily, then expires after 20 minutes.
 */

export type RegistrationCachedFileKey =
  | "prcIdFile"
  | "seniorPwdIdFile"
  | "receiptFile"
  | "bir2303File"
  | "bir2307File";

export const REGISTRATION_CACHED_FILE_KEYS: RegistrationCachedFileKey[] = [
  "prcIdFile",
  "seniorPwdIdFile",
  "receiptFile",
  "bir2303File",
  "bir2307File",
];

/** Keep uploads for 20 minutes, then remove them. */
const TTL_MS = 20 * 60 * 1000;
const DB_NAME = "pna-registration-files";
const DB_VERSION = 1;
const STORE_NAME = "files";

type StoredFileRecord = {
  id: string;
  eventKey: string;
  fileKey: RegistrationCachedFileKey;
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
  savedAt: number;
};

function eventScope(eventId?: string | null): string {
  return eventId?.trim() || "general";
}

function recordId(eventId: string | null | undefined, fileKey: RegistrationCachedFileKey): string {
  return `${eventScope(eventId)}:${fileKey}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("eventKey", "eventKey", { unique: false });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open file cache"));
  });
}

function isExpired(savedAt: number, now = Date.now()): boolean {
  return now - savedAt > TTL_MS;
}

function recordToFile(record: StoredFileRecord): File {
  return new File([record.blob], record.name, {
    type: record.type || "application/octet-stream",
    lastModified: record.lastModified || record.savedAt,
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const txDone = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("File cache transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("File cache transaction aborted"));
    });
    const value = await run(store);
    await txDone;
    return value;
  } finally {
    db.close();
  }
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function saveRegistrationCachedFile(
  eventId: string | null | undefined,
  fileKey: RegistrationCachedFileKey,
  file: File
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const savedAt = Date.now();
    const record: StoredFileRecord = {
      id: recordId(eventId, fileKey),
      eventKey: eventScope(eventId),
      fileKey,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      blob: file,
      savedAt,
    };
    await withStore("readwrite", (store) => idbRequest(store.put(record)));
  } catch {
    // Private mode / quota — form still works without cache.
  }
}

export async function removeRegistrationCachedFile(
  eventId: string | null | undefined,
  fileKey: RegistrationCachedFileKey
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await withStore("readwrite", (store) => idbRequest(store.delete(recordId(eventId, fileKey))));
  } catch {
    // ignore
  }
}

export async function clearRegistrationCachedFiles(
  eventId?: string | null
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const scope = eventScope(eventId);
    await withStore("readwrite", async (store) => {
      const index = store.index("eventKey");
      const rows = await idbRequest(index.getAll(scope));
      await Promise.all(
        (rows as StoredFileRecord[]).map((row) => idbRequest(store.delete(row.id)))
      );
    });
  } catch {
    // ignore
  }
}

export async function loadRegistrationCachedFiles(
  eventId?: string | null
): Promise<Partial<Record<RegistrationCachedFileKey, File>>> {
  if (typeof window === "undefined") return {};
  try {
    const scope = eventScope(eventId);
    const now = Date.now();
    return await withStore("readwrite", async (store) => {
      const index = store.index("eventKey");
      const rows = (await idbRequest(index.getAll(scope))) as StoredFileRecord[];
      const result: Partial<Record<RegistrationCachedFileKey, File>> = {};

      for (const row of rows) {
        if (isExpired(row.savedAt, now)) {
          await idbRequest(store.delete(row.id));
          continue;
        }
        if (!REGISTRATION_CACHED_FILE_KEYS.includes(row.fileKey)) continue;
        if (!(row.blob instanceof Blob)) continue;
        result[row.fileKey] = recordToFile(row);
      }

      return result;
    });
  } catch {
    return {};
  }
}

export function cacheRegistrationFile(
  eventId: string | null | undefined,
  fileKey: RegistrationCachedFileKey,
  file: File | null
): void {
  if (file) {
    void saveRegistrationCachedFile(eventId, fileKey, file);
  } else {
    void removeRegistrationCachedFile(eventId, fileKey);
  }
}
