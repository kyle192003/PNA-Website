import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { getBlobReadWriteToken, isServerlessRuntime } from "@/lib/security/server-env";
import { requireStorageId } from "@/lib/security/storage-id";
import {
  PRIVATE_UPLOADS_BUCKET,
  PUBLIC_UPLOADS_BUCKET,
  deleteStorageObject,
  downloadPrivateFile,
  uploadPrivateFile,
  uploadPublicFile,
  usesSupabaseStorage,
} from "@/lib/supabase/storage";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const PRIVATE_STORAGE_ROOT = path.join(process.cwd(), "storage");
const QR_DIR = path.join(UPLOADS_ROOT, "qrcodes");
const RECEIPT_DIR = path.join(PRIVATE_STORAGE_ROOT, "receipts");
const LEGACY_RECEIPT_DIR = path.join(UPLOADS_ROOT, "receipts");
const SPEAKER_DIR = path.join(UPLOADS_ROOT, "speakers");
const CERTIFICATE_DIR = path.join(UPLOADS_ROOT, "certificates");

function hasBlobToken(): boolean {
  return Boolean(getBlobReadWriteToken());
}

const RECEIPT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"] as const;

function missingDurableStorageError(kind: string): Error {
  return new Error(
    `Cannot save ${kind} on Vercel without Supabase. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`
  );
}

async function savePublicUpload(
  objectPath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  if (usesSupabaseStorage()) {
    return uploadPublicFile(objectPath, buffer, contentType);
  }

  if (hasBlobToken()) {
    const blob = await put(`uploads/${objectPath}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
    });
    return blob.url;
  }

  if (isServerlessRuntime()) {
    throw missingDurableStorageError("files");
  }

  return "";
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_RECEIPT_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_CERTIFICATE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REGISTRATION_DOC_SIZE = 10 * 1024 * 1024;
const REGISTRATION_DOCS_DIR = path.join(PRIVATE_STORAGE_ROOT, "registration-docs");

const ALLOWED_CERTIFICATE_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
]);

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

const MAGIC_SIGNATURES: Array<{ mime: string; bytes: number[] }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP checked below
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

async function ensureUploadDirs(): Promise<void> {
  await fs.mkdir(QR_DIR, { recursive: true });
  await fs.mkdir(RECEIPT_DIR, { recursive: true });
  await fs.mkdir(REGISTRATION_DOCS_DIR, { recursive: true });
  await fs.mkdir(SPEAKER_DIR, { recursive: true });
  await fs.mkdir(CERTIFICATE_DIR, { recursive: true });
}

function getExtension(filename: string, mimeType: string): string {
  const fromName = path.extname(filename).toLowerCase();
  if (fromName && EXTENSION_MIME_MAP[fromName]) return fromName;

  const mimeMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
  };
  return mimeMap[mimeType] ?? ".bin";
}

function resolveMimeType(file: File): string {
  const fromBrowser = file.type.trim().toLowerCase();
  if (fromBrowser && fromBrowser !== "application/octet-stream") {
    return fromBrowser;
  }

  const ext = path.extname(file.name).toLowerCase();
  return EXTENSION_MIME_MAP[ext] ?? fromBrowser;
}

function detectMimeFromBuffer(buffer: Buffer): string | null {
  for (const signature of MAGIC_SIGNATURES) {
    if (buffer.length < signature.bytes.length) continue;
    const matches = signature.bytes.every((byte, index) => buffer[index] === byte);
    if (!matches) continue;
    if (signature.mime === "image/webp") {
      if (buffer.length < 12) return null;
      if (buffer.toString("ascii", 8, 12) !== "WEBP") return null;
    }
    return signature.mime;
  }
  return null;
}

function validateFile(
  file: File,
  allowedTypes: Set<string>,
  maxSize = MAX_FILE_SIZE
): { ok: true; mimeType: string } | { ok: false; error: string } {
  const mimeType = resolveMimeType(file);
  if (!allowedTypes.has(mimeType)) {
    return {
      ok: false,
      error: `Unsupported file type. Use JPG, PNG, WebP, GIF, or PDF (received "${mimeType || "unknown"}").`,
    };
  }
  if (file.size > maxSize) {
    const limitMb = Math.round(maxSize / (1024 * 1024));
    return { ok: false, error: `File must be ${limitMb} MB or smaller.` };
  }
  return { ok: true, mimeType };
}

async function validateBufferMime(
  buffer: Buffer,
  claimedMime: string,
  allowedTypes: Set<string>
): Promise<{ ok: true; mimeType: string } | { ok: false; error: string }> {
  const detected = detectMimeFromBuffer(buffer);
  if (!detected || !allowedTypes.has(detected)) {
    return {
      ok: false,
      error: "File contents do not match an allowed image or PDF type.",
    };
  }
  // Prefer detected type over client claim when they disagree.
  if (claimedMime && claimedMime !== detected && claimedMime !== "application/octet-stream") {
    // Allow jpeg/jpg aliasing only; otherwise require match.
    const jpegFamily =
      (claimedMime === "image/jpeg" || claimedMime === "image/jpg") &&
      detected === "image/jpeg";
    if (!jpegFamily && claimedMime !== detected) {
      return {
        ok: false,
        error: "File contents do not match the declared file type.",
      };
    }
  }
  return { ok: true, mimeType: detected };
}

function assertInsideRoot(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(candidate);
  const prefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(prefix)) {
    throw new Error("Invalid upload path.");
  }
  return resolvedPath;
}

export async function saveQrCode(eventId: string, file: File): Promise<string> {
  const safeEventId = requireStorageId(eventId, "event id");
  const validation = validateFile(file, ALLOWED_IMAGE_TYPES);
  if (!validation.ok) throw new Error(validation.error);

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeCheck = await validateBufferMime(buffer, validation.mimeType, ALLOWED_IMAGE_TYPES);
  if (!mimeCheck.ok) throw new Error(mimeCheck.error);

  const ext = getExtension(file.name, mimeCheck.mimeType);
  const filename = `${safeEventId}${ext}`;
  const remoteUrl = await savePublicUpload(`qrcodes/${filename}`, buffer, mimeCheck.mimeType);
  if (remoteUrl) return remoteUrl;

  await ensureUploadDirs();
  const filepath = assertInsideRoot(QR_DIR, path.join(QR_DIR, filename));
  await fs.writeFile(filepath, buffer);

  return `/uploads/qrcodes/${filename}`;
}

export async function saveSpeakerPhoto(
  eventId: string,
  speakerId: string,
  file: File
): Promise<string> {
  const safeEventId = requireStorageId(eventId, "event id");
  const safeSpeakerId = requireStorageId(speakerId, "speaker id");
  const validation = validateFile(file, ALLOWED_IMAGE_TYPES);
  if (!validation.ok) throw new Error(validation.error);

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeCheck = await validateBufferMime(buffer, validation.mimeType, ALLOWED_IMAGE_TYPES);
  if (!mimeCheck.ok) throw new Error(mimeCheck.error);

  const ext = getExtension(file.name, mimeCheck.mimeType);
  const filename = `${safeEventId}-${safeSpeakerId}${ext}`;
  const remoteUrl = await savePublicUpload(`speakers/${filename}`, buffer, mimeCheck.mimeType);
  if (remoteUrl) return remoteUrl;

  await ensureUploadDirs();
  const filepath = assertInsideRoot(SPEAKER_DIR, path.join(SPEAKER_DIR, filename));
  await fs.writeFile(filepath, buffer);

  return `/uploads/speakers/${filename}`;
}

/** Stored receipt reference — not a public URL. */
export function buildReceiptStorageRef(registrationId: string, ext: string): string {
  return `private:receipts/${registrationId}${ext}`;
}

export function isPrivateReceiptRef(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith("private:receipts/"));
}

export async function saveReceipt(
  registrationId: string,
  file: File
): Promise<string> {
  const safeRegistrationId = requireStorageId(registrationId, "registration id");
  const validation = validateFile(file, ALLOWED_RECEIPT_TYPES, MAX_REGISTRATION_DOC_SIZE);
  if (!validation.ok) throw new Error(validation.error);

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeCheck = await validateBufferMime(buffer, validation.mimeType, ALLOWED_RECEIPT_TYPES);
  if (!mimeCheck.ok) throw new Error(mimeCheck.error);

  const ext = getExtension(file.name, mimeCheck.mimeType);
  await removeReceiptFiles(safeRegistrationId);

  if (usesSupabaseStorage()) {
    await uploadPrivateFile(`receipts/${safeRegistrationId}${ext}`, buffer, mimeCheck.mimeType);
    return buildReceiptStorageRef(safeRegistrationId, ext);
  }

  if (isServerlessRuntime() && !hasBlobToken()) {
    throw missingDurableStorageError("receipts");
  }

  await ensureUploadDirs();
  const filename = `${safeRegistrationId}${ext}`;
  const filepath = assertInsideRoot(RECEIPT_DIR, path.join(RECEIPT_DIR, filename));
  await fs.writeFile(filepath, buffer);
  return buildReceiptStorageRef(safeRegistrationId, ext);
}

export type RegistrationDocKind =
  | "pnaId"
  | "prcId"
  | "bir2303"
  | "bir2307"
  | "seniorPwdId";

export function buildRegistrationDocRef(
  registrationId: string,
  kind: RegistrationDocKind,
  ext: string
): string {
  return `private:registration-docs/${registrationId}-${kind}${ext}`;
}

export async function saveRegistrationDocument(
  registrationId: string,
  kind: RegistrationDocKind,
  file: File,
  options?: { imagesOnly?: boolean }
): Promise<string> {
  const allowed = options?.imagesOnly ? ALLOWED_IMAGE_TYPES : ALLOWED_RECEIPT_TYPES;
  const validation = validateFile(file, allowed, MAX_REGISTRATION_DOC_SIZE);
  if (!validation.ok) throw new Error(validation.error);

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeCheck = await validateBufferMime(buffer, validation.mimeType, allowed);
  if (!mimeCheck.ok) throw new Error(mimeCheck.error);

  const safeRegistrationId = requireStorageId(registrationId, "registration id");
  const ext = getExtension(file.name, mimeCheck.mimeType);
  await removeRegistrationDocFiles(safeRegistrationId, kind);

  if (usesSupabaseStorage()) {
    await uploadPrivateFile(
      `registration-docs/${safeRegistrationId}-${kind}${ext}`,
      buffer,
      mimeCheck.mimeType
    );
    return buildRegistrationDocRef(safeRegistrationId, kind, ext);
  }

  if (isServerlessRuntime() && !hasBlobToken()) {
    throw missingDurableStorageError("registration documents");
  }

  await ensureUploadDirs();
  const filename = `${safeRegistrationId}-${kind}${ext}`;
  const filepath = assertInsideRoot(
    REGISTRATION_DOCS_DIR,
    path.join(REGISTRATION_DOCS_DIR, filename)
  );
  await fs.writeFile(filepath, buffer);
  return buildRegistrationDocRef(safeRegistrationId, kind, ext);
}

export async function resolveRegistrationDocument(
  registrationId: string,
  kind: RegistrationDocKind,
  storedRef?: string | null
): Promise<ResolvedReceiptFile | null> {
  const safeRegistrationId = requireStorageId(registrationId, "registration id");

  if (usesSupabaseStorage()) {
    const objectPaths: string[] = [];
    if (storedRef?.startsWith("private:registration-docs/")) {
      objectPaths.push(storedRef.replace(/^private:/, ""));
    }
    for (const ext of RECEIPT_EXTENSIONS) {
      objectPaths.push(`registration-docs/${safeRegistrationId}-${kind}${ext}`);
    }
    return downloadFirstPrivateFile(objectPaths);
  }

  await ensureUploadDirs();
  const candidates: string[] = [];
  if (storedRef?.startsWith("private:registration-docs/")) {
    candidates.push(path.join(PRIVATE_STORAGE_ROOT, storedRef.replace(/^private:/, "")));
  }
  for (const ext of RECEIPT_EXTENSIONS) {
    candidates.push(path.join(REGISTRATION_DOCS_DIR, `${safeRegistrationId}-${kind}${ext}`));
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const root = path.resolve(REGISTRATION_DOCS_DIR);
    if (!(normalized.startsWith(root + path.sep) || normalized === root)) continue;
    try {
      await fs.access(normalized);
      const ext = path.extname(normalized).toLowerCase();
      return {
        absolutePath: normalized,
        mimeType: EXTENSION_MIME_MAP[ext] ?? "application/octet-stream",
        filename: path.basename(normalized),
      };
    } catch {
      // continue
    }
  }
  return null;
}

export type ResolvedReceiptFile = {
  mimeType: string;
  filename: string;
  absolutePath?: string;
  bytes?: Buffer;
};

export async function readResolvedFile(file: ResolvedReceiptFile): Promise<Buffer> {
  if (file.bytes) return file.bytes;
  if (file.absolutePath) return fs.readFile(file.absolutePath);
  throw new Error("File not found.");
}

async function downloadFirstPrivateFile(objectPaths: string[]): Promise<ResolvedReceiptFile | null> {
  const seen = new Set<string>();
  for (const objectPath of objectPaths) {
    const normalized = objectPath.replace(/^\/+/, "");
    if (!normalized || seen.has(normalized) || normalized.includes("..")) continue;
    seen.add(normalized);
    const bytes = await downloadPrivateFile(normalized);
    if (!bytes) continue;
    const filename = path.posix.basename(normalized);
    const ext = path.posix.extname(filename).toLowerCase();
    return {
      filename,
      mimeType: EXTENSION_MIME_MAP[ext] ?? "application/octet-stream",
      bytes,
    };
  }
  return null;
}

export async function resolveReceiptFile(
  registrationId: string,
  storedRef?: string | null
): Promise<ResolvedReceiptFile | null> {
  const safeRegistrationId = requireStorageId(registrationId, "registration id");

  if (usesSupabaseStorage()) {
    const objectPaths: string[] = [];
    if (storedRef?.startsWith("private:receipts/")) {
      objectPaths.push(storedRef.replace(/^private:/, ""));
    }
    for (const ext of RECEIPT_EXTENSIONS) {
      objectPaths.push(`receipts/${safeRegistrationId}${ext}`);
    }
    return downloadFirstPrivateFile(objectPaths);
  }

  await ensureUploadDirs();

  const candidates: string[] = [];
  if (storedRef?.startsWith("private:receipts/")) {
    candidates.push(path.join(PRIVATE_STORAGE_ROOT, storedRef.replace(/^private:/, "")));
  } else if (storedRef?.startsWith("/uploads/receipts/")) {
    candidates.push(path.join(process.cwd(), "public", storedRef.replace(/^\//, "")));
  }

  // Also probe common extensions in private then legacy public dirs.
  for (const ext of RECEIPT_EXTENSIONS) {
    candidates.push(path.join(RECEIPT_DIR, `${safeRegistrationId}${ext}`));
    candidates.push(path.join(LEGACY_RECEIPT_DIR, `${safeRegistrationId}${ext}`));
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const underPrivate = normalized.startsWith(path.resolve(RECEIPT_DIR) + path.sep) ||
      normalized === path.resolve(RECEIPT_DIR);
    const underLegacy =
      normalized.startsWith(path.resolve(LEGACY_RECEIPT_DIR) + path.sep) ||
      normalized === path.resolve(LEGACY_RECEIPT_DIR);
    if (!underPrivate && !underLegacy) continue;

    try {
      await fs.access(normalized);
      const filename = path.basename(normalized);
      const ext = path.extname(filename).toLowerCase();
      return {
        absolutePath: normalized,
        filename,
        mimeType: EXTENSION_MIME_MAP[ext] ?? "application/octet-stream",
      };
    } catch {
      // try next
    }
  }

  return null;
}

async function removeReceiptFiles(registrationId: string): Promise<void> {
  if (usesSupabaseStorage()) {
    await Promise.all(
      RECEIPT_EXTENSIONS.map((ext) =>
        deleteStorageObject(PRIVATE_UPLOADS_BUCKET, `receipts/${registrationId}${ext}`)
      )
    );
  }

  for (const dir of [RECEIPT_DIR, LEGACY_RECEIPT_DIR]) {
    try {
      const entries = await fs.readdir(dir);
      await Promise.all(
        entries
          .filter((name) => name.startsWith(registrationId))
          .map((name) => fs.unlink(path.join(dir, name)).catch(() => undefined))
      );
    } catch {
      // directory may not exist yet
    }
  }
}

async function removeRegistrationDocFiles(
  registrationId: string,
  kind: RegistrationDocKind
): Promise<void> {
  if (usesSupabaseStorage()) {
    await Promise.all(
      RECEIPT_EXTENSIONS.map((ext) =>
        deleteStorageObject(
          PRIVATE_UPLOADS_BUCKET,
          `registration-docs/${registrationId}-${kind}${ext}`
        )
      )
    );
  }

  try {
    await fs.mkdir(REGISTRATION_DOCS_DIR, { recursive: true });
    await Promise.all(
      RECEIPT_EXTENSIONS.map((ext) =>
        fs.unlink(path.join(REGISTRATION_DOCS_DIR, `${registrationId}-${kind}${ext}`)).catch(
          () => undefined
        )
      )
    );
  } catch {
    // directory may not exist yet
  }
}

export type CertificateTemplateFileType = "image" | "pdf";

export type SavedCertificateTemplateFile = {
  fileUrl: string;
  fileType: CertificateTemplateFileType;
};

async function removeExistingCertificateTemplates(eventId?: string | null): Promise<void> {
  const prefix = eventId ? `certificate-${eventId}` : "certificate-template";
  if (usesSupabaseStorage()) {
    await Promise.all(
      [...RECEIPT_EXTENSIONS, ".bin"].map((ext) =>
        deleteStorageObject(PUBLIC_UPLOADS_BUCKET, `certificates/${prefix}${ext}`)
      )
    );
  }

  try {
    await ensureUploadDirs();
    const entries = await fs.readdir(CERTIFICATE_DIR);
    await Promise.all(
      entries
        .filter((name) => name.startsWith(prefix))
        .map((name) => fs.unlink(path.join(CERTIFICATE_DIR, name)).catch(() => undefined))
    );
  } catch {
    // local cert folder may not exist
  }
}

export async function saveCertificateTemplateFile(
  file: File,
  eventId?: string | null
): Promise<SavedCertificateTemplateFile> {
  const validation = validateFile(file, ALLOWED_CERTIFICATE_TYPES, MAX_CERTIFICATE_FILE_SIZE);
  if (!validation.ok) throw new Error(validation.error);

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeCheck = await validateBufferMime(
    buffer,
    validation.mimeType,
    ALLOWED_CERTIFICATE_TYPES
  );
  if (!mimeCheck.ok) throw new Error(mimeCheck.error);

  const ext = getExtension(file.name, mimeCheck.mimeType);
  const fileType: CertificateTemplateFileType =
    mimeCheck.mimeType === "application/pdf" ? "pdf" : "image";
  const safeEventId = eventId ? requireStorageId(eventId, "event id") : null;
  const filename = safeEventId
    ? `certificate-${safeEventId}${ext}`
    : `certificate-template${ext}`;

  await removeExistingCertificateTemplates(safeEventId);

  const remoteUrl = await savePublicUpload(`certificates/${filename}`, buffer, mimeCheck.mimeType);
  if (remoteUrl) {
    return { fileUrl: remoteUrl, fileType };
  }

  await ensureUploadDirs();
  const filepath = assertInsideRoot(CERTIFICATE_DIR, path.join(CERTIFICATE_DIR, filename));

  try {
    await fs.writeFile(filepath, buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save file.";
    throw new Error(`Failed to save certificate template: ${message}`);
  }

  return {
    fileUrl: `/uploads/certificates/${filename}`,
    fileType,
  };
}

/** @deprecated Use saveCertificateTemplateFile */
export async function saveCertificateTemplateImage(file: File): Promise<string> {
  const saved = await saveCertificateTemplateFile(file);
  return saved.fileUrl;
}

export async function deleteUploadedFile(publicUrl: string | null): Promise<void> {
  if (!publicUrl) return;

  if (publicUrl.startsWith("private:")) {
    const relative = publicUrl.replace(/^private:/, "").replace(/\\/g, "/");
    if (!relative || relative.includes("..")) return;
    if (usesSupabaseStorage()) {
      await deleteStorageObject(PRIVATE_UPLOADS_BUCKET, relative);
    }
    try {
      const filepath = assertInsideRoot(
        PRIVATE_STORAGE_ROOT,
        path.join(PRIVATE_STORAGE_ROOT, relative)
      );
      await fs.unlink(filepath);
    } catch {
      // File may already be removed.
    }
    return;
  }

  const supabaseObject = parseSupabasePublicObjectPath(publicUrl);
  if (supabaseObject) {
    await deleteStorageObject(PUBLIC_UPLOADS_BUCKET, supabaseObject);
    return;
  }

  if (!publicUrl.startsWith("/uploads/")) return;

  const relative = publicUrl.replace(/^\/uploads\//, "").replace(/\\/g, "/");
  if (!relative || relative.includes("..")) return;

  const filepath = assertInsideRoot(UPLOADS_ROOT, path.join(UPLOADS_ROOT, relative));

  try {
    await fs.unlink(filepath);
  } catch {
    // File may already be removed.
  }
}

function parseSupabasePublicObjectPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${PUBLIC_UPLOADS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const objectPath = decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
  if (!objectPath || objectPath.includes("..")) return null;
  return objectPath;
}

export function getPrivateStorageRoot(): string {
  return PRIVATE_STORAGE_ROOT;
}
