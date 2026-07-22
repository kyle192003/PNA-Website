import { promises as fs } from "fs";
import path from "path";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const QR_DIR = path.join(UPLOADS_ROOT, "qrcodes");
const RECEIPT_DIR = path.join(UPLOADS_ROOT, "receipts");
const SPEAKER_DIR = path.join(UPLOADS_ROOT, "speakers");
const CERTIFICATE_DIR = path.join(UPLOADS_ROOT, "certificates");

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

async function ensureUploadDirs(): Promise<void> {
  await fs.mkdir(QR_DIR, { recursive: true });
  await fs.mkdir(RECEIPT_DIR, { recursive: true });
  await fs.mkdir(SPEAKER_DIR, { recursive: true });
  await fs.mkdir(CERTIFICATE_DIR, { recursive: true });
}

function getExtension(filename: string, mimeType: string): string {
  const fromName = path.extname(filename).toLowerCase();
  if (fromName) return fromName;

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

export async function saveQrCode(eventId: string, file: File): Promise<string> {
  await ensureUploadDirs();
  const validation = validateFile(file, ALLOWED_IMAGE_TYPES);
  if (!validation.ok) throw new Error(validation.error);

  const ext = getExtension(file.name, validation.mimeType);
  const filename = `${eventId}${ext}`;
  const filepath = path.join(QR_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buffer);

  return `/uploads/qrcodes/${filename}`;
}

export async function saveSpeakerPhoto(
  eventId: string,
  speakerId: string,
  file: File
): Promise<string> {
  await ensureUploadDirs();
  const validation = validateFile(file, ALLOWED_IMAGE_TYPES);
  if (!validation.ok) throw new Error(validation.error);

  const ext = getExtension(file.name, validation.mimeType);
  const filename = `${eventId}-${speakerId}${ext}`;
  const filepath = path.join(SPEAKER_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buffer);

  return `/uploads/speakers/${filename}`;
}

export async function saveReceipt(
  registrationId: string,
  file: File
): Promise<string> {
  await ensureUploadDirs();
  const validation = validateFile(file, ALLOWED_RECEIPT_TYPES);
  if (!validation.ok) throw new Error(validation.error);

  const ext = getExtension(file.name, validation.mimeType);
  const filename = `${registrationId}${ext}`;
  const filepath = path.join(RECEIPT_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buffer);

  return `/uploads/receipts/${filename}`;
}

export type CertificateTemplateFileType = "image" | "pdf";

export type SavedCertificateTemplateFile = {
  fileUrl: string;
  fileType: CertificateTemplateFileType;
};

async function removeExistingCertificateTemplates(eventId?: string | null): Promise<void> {
  await ensureUploadDirs();
  const entries = await fs.readdir(CERTIFICATE_DIR);
  const prefix = eventId ? `certificate-${eventId}` : "certificate-template";
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix))
      .map((name) => fs.unlink(path.join(CERTIFICATE_DIR, name)).catch(() => undefined))
  );
}

export async function saveCertificateTemplateFile(
  file: File,
  eventId?: string | null
): Promise<SavedCertificateTemplateFile> {
  await ensureUploadDirs();
  const validation = validateFile(file, ALLOWED_CERTIFICATE_TYPES, MAX_CERTIFICATE_FILE_SIZE);
  if (!validation.ok) throw new Error(validation.error);

  const ext = getExtension(file.name, validation.mimeType);
  const fileType: CertificateTemplateFileType =
    validation.mimeType === "application/pdf" ? "pdf" : "image";
  const filename = eventId
    ? `certificate-${eventId}${ext}`
    : `certificate-template${ext}`;
  const filepath = path.join(CERTIFICATE_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());

  await removeExistingCertificateTemplates(eventId);

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
  if (!publicUrl?.startsWith("/uploads/")) return;

  const relative = publicUrl.replace(/^\/uploads\//, "");
  const filepath = path.join(UPLOADS_ROOT, relative);

  try {
    await fs.unlink(filepath);
  } catch {
    // File may already be removed.
  }
}
