import { promises as fs } from "fs";
import path from "path";
import { conference } from "@/lib/conference";
import { formatParticipantName } from "@/lib/participant-name";
import type { CertificateTemplate, ConferenceEvent, RegistrationRecord } from "@/lib/types/admin";

const DATA_DIR = path.join(process.cwd(), "data");
const GLOBAL_DATA_FILE = path.join(DATA_DIR, "certificate-template.json");
const EVENT_TEMPLATES_DIR = path.join(DATA_DIR, "certificate-templates");

export const CERTIFICATE_PLACEHOLDERS = [
  "{{name}}",
  "{{event}}",
  "{{dates}}",
  "{{reference}}",
  "{{certificateId}}",
  "{{issuedAt}}",
  "{{organization}}",
] as const;

export const DEFAULT_CERTIFICATE_TEMPLATE: CertificateTemplate = {
  subject: "Certificate of Participation: {{event}}",
  fileType: "image",
  imageUrl: null,
  namePosXPercent: 50,
  namePosYPercent: 45,
  nameWidthPercent: 66,
  nameHeightPercent: 10,
  nameColor: "#ffffff",
  nameFontWeight: 700,
  updatedAt: new Date(0).toISOString(),
};

function eventTemplatePath(eventId: string): string {
  return path.join(EVENT_TEMPLATES_DIR, `${eventId}.json`);
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(EVENT_TEMPLATES_DIR, { recursive: true });
  try {
    await fs.access(GLOBAL_DATA_FILE);
  } catch {
    await fs.writeFile(
      GLOBAL_DATA_FILE,
      JSON.stringify(DEFAULT_CERTIFICATE_TEMPLATE, null, 2),
      "utf-8"
    );
  }
}

function normalizeTemplate(
  parsed: Partial<CertificateTemplate> & {
    templateType?: string;
    htmlBody?: string;
    nameFontSizePx?: number;
  }
): CertificateTemplate {
  return {
    subject: parsed.subject?.trim() || DEFAULT_CERTIFICATE_TEMPLATE.subject,
    fileType: resolveCertificateFileType(parsed),
    imageUrl: parsed.imageUrl ?? DEFAULT_CERTIFICATE_TEMPLATE.imageUrl,
    namePosXPercent:
      typeof parsed.namePosXPercent === "number"
        ? parsed.namePosXPercent
        : DEFAULT_CERTIFICATE_TEMPLATE.namePosXPercent,
    namePosYPercent:
      typeof parsed.namePosYPercent === "number"
        ? parsed.namePosYPercent
        : DEFAULT_CERTIFICATE_TEMPLATE.namePosYPercent,
    nameWidthPercent:
      typeof parsed.nameWidthPercent === "number"
        ? parsed.nameWidthPercent
        : DEFAULT_CERTIFICATE_TEMPLATE.nameWidthPercent,
    nameHeightPercent:
      typeof parsed.nameHeightPercent === "number"
        ? parsed.nameHeightPercent
        : DEFAULT_CERTIFICATE_TEMPLATE.nameHeightPercent,
    nameColor:
      typeof parsed.nameColor === "string" && parsed.nameColor.trim()
        ? parsed.nameColor
        : DEFAULT_CERTIFICATE_TEMPLATE.nameColor,
    nameFontWeight:
      typeof parsed.nameFontWeight === "number"
        ? parsed.nameFontWeight
        : DEFAULT_CERTIFICATE_TEMPLATE.nameFontWeight,
    updatedAt: parsed.updatedAt ?? DEFAULT_CERTIFICATE_TEMPLATE.updatedAt,
  };
}

async function readTemplateFile(filePath: string): Promise<CertificateTemplate | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return normalizeTemplate(JSON.parse(content));
  } catch {
    return null;
  }
}

/** Global fallback / default template. */
export async function getGlobalCertificateTemplate(): Promise<CertificateTemplate> {
  await ensureDirs();
  return (
    (await readTemplateFile(GLOBAL_DATA_FILE)) ?? {
      ...DEFAULT_CERTIFICATE_TEMPLATE,
      updatedAt: new Date().toISOString(),
    }
  );
}

/**
 * Event-specific certificate. Falls back to global template when the event
 * does not have its own uploaded template yet.
 */
export async function getCertificateTemplate(
  eventId?: string | null
): Promise<CertificateTemplate> {
  await ensureDirs();

  if (eventId) {
    const eventTemplate = await readTemplateFile(eventTemplatePath(eventId));
    if (eventTemplate?.imageUrl) {
      return eventTemplate;
    }
    if (eventTemplate) {
      const global = await getGlobalCertificateTemplate();
      return {
        ...global,
        ...eventTemplate,
        imageUrl: eventTemplate.imageUrl ?? global.imageUrl,
        subject: eventTemplate.subject || global.subject,
      };
    }
  }

  return getGlobalCertificateTemplate();
}

export async function saveCertificateTemplate(
  input: Omit<CertificateTemplate, "updatedAt">,
  eventId?: string | null
): Promise<CertificateTemplate> {
  await ensureDirs();
  if (!input.subject.trim()) {
    throw new Error("Certificate subject is required.");
  }
  if (!input.imageUrl) {
    throw new Error("Upload a certificate image first.");
  }

  const template: CertificateTemplate = {
    subject: input.subject.trim(),
    fileType: input.fileType === "pdf" ? "pdf" : "image",
    imageUrl: input.imageUrl,
    namePosXPercent: clamp(input.namePosXPercent, 0, 100),
    namePosYPercent: clamp(input.namePosYPercent, 0, 100),
    nameWidthPercent: clamp(input.nameWidthPercent, 20, 100),
    nameHeightPercent: clamp(input.nameHeightPercent, 4, 40),
    nameColor: input.nameColor,
    nameFontWeight: clamp(input.nameFontWeight, 400, 800),
    updatedAt: new Date().toISOString(),
  };

  const target = eventId ? eventTemplatePath(eventId) : GLOBAL_DATA_FILE;
  await fs.writeFile(target, JSON.stringify(template, null, 2), "utf-8");
  return template;
}

export type CertificateRenderContext = {
  name: string;
  event: string;
  dates: string;
  reference: string;
  certificateId: string;
  issuedAt: string;
  organization: string;
};

export function buildCertificateRenderContext(
  registration: RegistrationRecord,
  event: Pick<ConferenceEvent, "title" | "datesDisplay">
): CertificateRenderContext {
  const issuedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    name: formatParticipantName(registration),
    event: event.title,
    dates: event.datesDisplay || "the scheduled event date",
    reference: registration.referenceNumber,
    certificateId: `${registration.referenceNumber}-${new Date().getFullYear()}`,
    issuedAt,
    organization: conference.organization,
  };
}

export function buildSampleCertificateContext(
  event?: Pick<ConferenceEvent, "title" | "datesDisplay"> | null
): CertificateRenderContext {
  return {
    name: "Juan Dela Cruz",
    event: event?.title ?? "2026 National Conference & General Assembly",
    dates: event?.datesDisplay ?? "October 14 to 16, 2026",
    reference: "PNA-2026-12345",
    certificateId: "PNA-2026-12345-2026",
    issuedAt: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    organization: conference.organization,
  };
}

export function renderCertificateSubject(
  template: Omit<CertificateTemplate, "updatedAt">,
  context: CertificateRenderContext
): string {
  return replaceCertificatePlaceholders(template.subject, context);
}

export function replaceCertificatePlaceholders(
  value: string,
  context: CertificateRenderContext
): string {
  return value
    .replaceAll("{{name}}", context.name)
    .replaceAll("{{event}}", context.event)
    .replaceAll("{{dates}}", context.dates)
    .replaceAll("{{reference}}", context.reference)
    .replaceAll("{{certificateId}}", context.certificateId)
    .replaceAll("{{issuedAt}}", context.issuedAt)
    .replaceAll("{{organization}}", context.organization);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function resolveCertificateFileType(
  parsed: Partial<CertificateTemplate> & { fileType?: string; imageUrl?: string | null }
): "image" | "pdf" {
  if (parsed.fileType === "pdf" || parsed.fileType === "image") {
    return parsed.fileType;
  }

  if (parsed.imageUrl?.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }

  return DEFAULT_CERTIFICATE_TEMPLATE.fileType;
}
