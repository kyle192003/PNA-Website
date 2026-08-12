import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { getEventById, updateEvent } from "@/lib/events";
import { getBlobReadWriteToken, isServerlessRuntime } from "@/lib/security/server-env";
import { requireStorageId } from "@/lib/security/storage-id";
import {
  buildEventRegistrationUrl,
  buildQuickChartQrUrl,
  buildRegistrationQrDetails,
} from "@/lib/registration-qr-urls";
import { uploadPublicFile, usesSupabaseStorage } from "@/lib/supabase/storage";

const REGISTRATION_QR_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "registration-qrcodes"
);

export interface RegistrationQrDetails {
  eventId: string;
  eventTitle: string;
  registrationUrl: string;
  qrCodeUrl: string;
  quickChartUrl: string;
}

export { buildEventRegistrationUrl, buildQuickChartQrUrl } from "@/lib/registration-qr-urls";

export async function generateAndSaveRegistrationQr(
  eventId: string,
  options?: { caption?: string; baseUrl?: string }
): Promise<string> {
  const registrationUrl = buildEventRegistrationUrl(eventId, options?.baseUrl);
  const quickChartUrl = buildQuickChartQrUrl(registrationUrl, {
    size: 600,
    margin: 2,
    caption: options?.caption,
  });

  const response = await fetch(quickChartUrl);
  if (!response.ok) {
    throw new Error("Failed to generate registration QR code from QuickChart.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const safeEventId = requireStorageId(eventId, "event id");
  const filename = `${safeEventId}.png`;

  if (usesSupabaseStorage()) {
    return uploadPublicFile(`registration-qrcodes/${filename}`, buffer, "image/png");
  }

  if (getBlobReadWriteToken()) {
    const blob = await put(`uploads/registration-qrcodes/${filename}`, buffer, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
    });
    return blob.url;
  }

  if (isServerlessRuntime()) {
    throw new Error(
      "Cannot save registration QR codes on Vercel without Supabase. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  await fs.mkdir(REGISTRATION_QR_DIR, { recursive: true });
  const filepath = path.resolve(REGISTRATION_QR_DIR, filename);
  const root = path.resolve(REGISTRATION_QR_DIR);
  if (filepath !== root && !filepath.startsWith(root + path.sep)) {
    throw new Error("Invalid event id.");
  }
  await fs.writeFile(filepath, buffer);

  return `/uploads/registration-qrcodes/${filename}`;
}

export async function ensureEventRegistrationQr(
  eventId: string,
  options?: { regenerate?: boolean; baseUrl?: string }
): Promise<RegistrationQrDetails | null> {
  const event = await getEventById(eventId);
  if (!event) return null;

  let qrCodeUrl = event.registrationQrCodeUrl;

  if (!qrCodeUrl || options?.regenerate) {
    qrCodeUrl = await generateAndSaveRegistrationQr(eventId, {
      caption: event.title,
      baseUrl: options?.baseUrl,
    });
    await updateEvent(eventId, { registrationQrCodeUrl: qrCodeUrl });
  }

  const qrDetails = buildRegistrationQrDetails(
    event.id,
    event.title,
    qrCodeUrl,
    options?.baseUrl
  );

  return {
    eventId: event.id,
    eventTitle: event.title,
    registrationUrl: qrDetails.registrationUrl,
    qrCodeUrl: qrDetails.qrCodeUrl,
    quickChartUrl: qrDetails.quickChartUrl,
  };
}
