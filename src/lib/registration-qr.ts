import { promises as fs } from "fs";
import path from "path";
import { getEventById, updateEvent } from "@/lib/events";
import {
  buildEventRegistrationUrl,
  buildQuickChartQrUrl,
  buildRegistrationQrDetails,
} from "@/lib/registration-qr-urls";
import { getSiteBaseUrl } from "@/lib/site-url";

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
  await fs.mkdir(REGISTRATION_QR_DIR, { recursive: true });

  const filename = `${eventId}.png`;
  await fs.writeFile(path.join(REGISTRATION_QR_DIR, filename), buffer);

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

  const registrationUrl = buildEventRegistrationUrl(eventId, options?.baseUrl);
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