import { NextResponse } from "next/server";
import {
  CERTIFICATE_PLACEHOLDERS,
  DEFAULT_CERTIFICATE_TEMPLATE,
  buildSampleCertificateContext,
  getCertificateTemplate,
  renderCertificateSubject,
  saveCertificateTemplate,
} from "@/lib/certificate-template";
import { generateCertificatePdf, generateCertificatePng } from "@/lib/certificate-pdf";
import { getEventById } from "@/lib/events";
import { sendMail } from "@/lib/mail";
import { conference } from "@/lib/conference";
import type { CertificateTemplate } from "@/lib/types/admin";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readJsonBody } from "@/lib/security/safe-input";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapEmail(subject: string, bodyHtml: string): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a3d2e;max-width:640px;margin:0 auto;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#14532d;">${escapeHtml(subject)}</h1>
      ${bodyHtml}
    </div>
  `;
}

function mergePreviewTemplate(
  body: Record<string, unknown>,
  current: CertificateTemplate
): Omit<CertificateTemplate, "updatedAt"> {
  return {
    subject:
      typeof body.subject === "string" && body.subject.trim()
        ? body.subject.trim()
        : current.subject,
    imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : current.imageUrl,
    fileType: body.fileType === "pdf" ? "pdf" : body.fileType === "image" ? "image" : current.fileType,
    namePosXPercent:
      typeof body.namePosXPercent === "number" ? body.namePosXPercent : current.namePosXPercent,
    namePosYPercent:
      typeof body.namePosYPercent === "number" ? body.namePosYPercent : current.namePosYPercent,
    nameWidthPercent:
      typeof body.nameWidthPercent === "number" ? body.nameWidthPercent : current.nameWidthPercent,
    nameHeightPercent:
      typeof body.nameHeightPercent === "number"
        ? body.nameHeightPercent
        : current.nameHeightPercent,
    nameColor: typeof body.nameColor === "string" ? body.nameColor : current.nameColor,
    nameFontWeight:
      typeof body.nameFontWeight === "number" ? body.nameFontWeight : current.nameFontWeight,
  };
}

function resolveEventId(source: URL | { eventId?: unknown }): string | null {
  if (source instanceof URL) {
    const value = source.searchParams.get("eventId");
    return value?.trim() || null;
  }
  return typeof source.eventId === "string" && source.eventId.trim()
    ? source.eventId.trim()
    : null;
}

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const eventId = resolveEventId(new URL(request.url));
  const template = await getCertificateTemplate(eventId);
  return NextResponse.json({
    template,
    eventId,
    placeholders: CERTIFICATE_PLACEHOLDERS,
    defaultTemplate: DEFAULT_CERTIFICATE_TEMPLATE,
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;
    const eventId = resolveEventId(body);
    const current = await getCertificateTemplate(eventId);
    const next: Omit<CertificateTemplate, "updatedAt"> = {
      subject: typeof body.subject === "string" ? body.subject : current.subject,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : current.imageUrl,
      fileType:
        body.fileType === "pdf" ? "pdf" : body.fileType === "image" ? "image" : current.fileType,
      namePosXPercent:
        typeof body.namePosXPercent === "number"
          ? body.namePosXPercent
          : current.namePosXPercent,
      namePosYPercent:
        typeof body.namePosYPercent === "number"
          ? body.namePosYPercent
          : current.namePosYPercent,
      nameWidthPercent:
        typeof body.nameWidthPercent === "number"
          ? body.nameWidthPercent
          : current.nameWidthPercent,
      nameHeightPercent:
        typeof body.nameHeightPercent === "number"
          ? body.nameHeightPercent
          : current.nameHeightPercent,
      nameColor: typeof body.nameColor === "string" ? body.nameColor : current.nameColor,
      nameFontWeight:
        typeof body.nameFontWeight === "number"
          ? body.nameFontWeight
          : current.nameFontWeight,
    };

    const template = await saveCertificateTemplate(next, eventId);
    return NextResponse.json({ template, eventId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save certificate template.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;
    const action = body.action;
    const eventId = resolveEventId(body);
    const event = eventId ? await getEventById(eventId) : null;
    const current = await getCertificateTemplate(eventId);
    const previewTemplate = mergePreviewTemplate(body, current);
    const sampleContext = buildSampleCertificateContext(event);

    if (action === "preview") {
      if (!previewTemplate.imageUrl) {
        return NextResponse.json(
          { error: "Upload a certificate image to preview." },
          { status: 400 }
        );
      }

      const pdf = await generateCertificatePdf(previewTemplate, sampleContext);
      const subject = renderCertificateSubject(previewTemplate, sampleContext);
      const preview: {
        subject: string;
        pdfDataUrl: string;
        imageDataUrl?: string;
      } = {
        subject,
        pdfDataUrl: `data:application/pdf;base64,${pdf.toString("base64")}`,
      };

      if (previewTemplate.fileType === "image") {
        const png = await generateCertificatePng(previewTemplate, sampleContext);
        preview.imageDataUrl = `data:image/png;base64,${png.toString("base64")}`;
      }

      return NextResponse.json({ preview });
    }

    if (action === "test-email") {
      const email = typeof body.email === "string" ? body.email.trim() : "";
      if (!email) {
        return NextResponse.json({ error: "Test email address is required." }, { status: 400 });
      }

      if (!previewTemplate.imageUrl) {
        return NextResponse.json(
          { error: "Upload a certificate image before sending a test email." },
          { status: 400 }
        );
      }

      const subject = renderCertificateSubject(previewTemplate, sampleContext);
      const pdf = await generateCertificatePdf(previewTemplate, sampleContext);

      const result = await sendMail({
        to: email,
        subject,
        html: wrapEmail(
          subject,
          `
            <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">Dear ${escapeHtml(sampleContext.name)},</p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#1a3d2e;">
              This is a test certificate email. Your certificate is attached as a PDF.
            </p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#1a3d2e;">
              <strong>Event:</strong> ${escapeHtml(sampleContext.event)}<br />
              <strong>Organization:</strong> ${escapeHtml(conference.organization)}
            </p>
          `
        ),
        text: [
          `Dear ${sampleContext.name},`,
          "",
          "This is a test certificate email. Your certificate is attached as a PDF.",
          `Event: ${sampleContext.event}`,
        ].join("\n"),
        attachments: [
          {
            filename: `certificate-${sampleContext.reference}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ message: "Test certificate email sent with PDF attached." });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Certificate action failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
