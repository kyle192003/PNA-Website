import { promises as fs } from "fs";
import path from "path";
import { conference } from "@/lib/conference";
import { buildCheckInQrImageUrl } from "@/lib/check-in-qr";
import {
  buildCertificateRenderContext,
  getCertificateTemplate,
  renderCertificateSubject,
} from "@/lib/certificate-template";
import { generateCertificatePdf } from "@/lib/certificate-pdf";
import { formatLongDate, type ReminderWindow } from "@/lib/event-date";
import { buildVenueMapsUrl } from "@/lib/event-utils";
import { formatParticipantName } from "@/lib/participant-name";
import { sendMail, type MailAttachment } from "@/lib/mail";
import { createReceiptReuploadToken } from "@/lib/receipt-reupload-token";
import { getSiteBaseUrl } from "@/lib/site-url";
import type { ConferenceEvent, RegistrationRecord } from "@/lib/types/admin";

const SPAM_NOTE =
  "If you don’t see this email in your inbox, please check your Spam/Junk folder and mark it as Not Spam.";

/** Inline logo CID — must match the attachment cid used in sendBrandedMail. */
const LOGO_CID = "pna-logo@pna";

const BRAND = {
  green: "#14532d",
  greenMid: "#15803d",
  greenSoft: "#ecfdf5",
  greenLine: "#4ade80",
  greenMuted: "#4b6b5c",
  text: "#1a3d2e",
  white: "#ffffff",
  pageBg: "#eef6f0",
};

type EventContext = Pick<
  ConferenceEvent,
  "id" | "title" | "datesDisplay" | "venueName" | "venueAddress" | "venueMapsUrl"
>;

function participantDisplayName(registration: RegistrationRecord): string {
  return formatParticipantName(registration);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function getLogoAttachment(): Promise<MailAttachment | null> {
  try {
    const logoPath = path.join(process.cwd(), "public", "images", "pna-logo.jpg");
    const content = await fs.readFile(logoPath);
    return {
      filename: "pna-logo.jpg",
      content,
      contentType: "image/jpeg",
      cid: LOGO_CID,
      contentDisposition: "inline",
    };
  } catch (error) {
    console.warn("[mail] Could not load PNA logo for inline email attachment:", error);
    return null;
  }
}

function emailCta(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto;border-collapse:collapse;">
      <tr>
        <td align="center" style="border-radius:9999px;background:${BRAND.greenMid};">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;color:${BRAND.white};text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.02em;border-radius:9999px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function emailCallout(title: string, bodyHtml: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 0;border-collapse:collapse;">
      <tr>
        <td style="background:${BRAND.greenSoft};border-left:4px solid ${BRAND.greenMid};padding:16px 18px;">
          <p style="margin:0 0 6px;color:${BRAND.green};font-size:14px;font-weight:700;">${escapeHtml(title)}</p>
          <div style="margin:0;color:${BRAND.greenMuted};font-size:13px;line-height:1.6;">${bodyHtml}</div>
        </td>
      </tr>
    </table>
  `;
}

function eventBlock(event: EventContext): { html: string; text: string } {
  const venueLine = [event.venueName, event.venueAddress].filter(Boolean).join(", ");
  const mapsUrl = buildVenueMapsUrl(event);
  const mapsHtml = mapsUrl
    ? `<tr><td style="padding:8px 0 0;"><a href="${escapeHtml(mapsUrl)}" style="color:${BRAND.greenMid};font-size:14px;font-weight:600;text-decoration:underline;">View on Google Maps</a></td></tr>`
    : "";
  const mapsText = mapsUrl ? `Map: ${mapsUrl}` : null;

  return {
    html: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:${BRAND.greenMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Event</td></tr>
        <tr><td style="padding:2px 0 12px;color:${BRAND.green};font-size:18px;font-weight:700;line-height:1.35;">${escapeHtml(event.title)}</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.greenMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Dates</td></tr>
        <tr><td style="padding:2px 0 12px;color:${BRAND.text};font-size:15px;line-height:1.5;">${escapeHtml(event.datesDisplay || "To be announced")}</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.greenMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Venue</td></tr>
        <tr><td style="padding:2px 0;color:${BRAND.text};font-size:15px;line-height:1.5;">${escapeHtml(venueLine || "To be announced")}</td></tr>
        ${mapsHtml}
      </table>
    `,
    text: [
      `Event: ${event.title}`,
      `Dates: ${event.datesDisplay || "To be announced"}`,
      `Venue: ${venueLine || "To be announced"}`,
      ...(mapsText ? [mapsText] : []),
    ].join("\n"),
  };
}

function qrBlock(token: string): { html: string; text: string } {
  const imageUrl = buildCheckInQrImageUrl(token);
  return {
    html: `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:20px;background:${BRAND.greenSoft};border-radius:12px;">
            <p style="margin:0 0 14px;color:${BRAND.green};font-size:15px;font-weight:700;">Your check-in QR code</p>
            <img src="${escapeHtml(imageUrl)}" alt="Check-in QR code" width="220" height="220" style="display:block;margin:0 auto;border:1px solid #d1fae5;border-radius:12px;background:#fff;" />
            <p style="margin:14px 0 0;color:${BRAND.greenMuted};font-size:13px;line-height:1.5;">Show this QR at the front desk on event day.</p>
          </td>
        </tr>
      </table>
    `,
    text: `Your check-in QR is attached as an image in the HTML version of this email.\nShow this QR at the front desk on event day.\nCheck-in token (for staff scanners): ${token}`,
  };
}

type WrapEmailOptions = {
  title: string;
  headline: string;
  bodyHtml: string;
};

/**
 * Cognizant-style branded layout: green header banner, white body,
 * accent callout, and green footer — table-based for email clients.
 */
function wrapEmail({ title, headline, bodyHtml }: WrapEmailOptions): string {
  const siteUrl = getSiteBaseUrl();
  const contactEmail = conference.contact.registrationEmail;
  const phone = conference.contact.phone;
  const venue = conference.venue;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND.pageBg};border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;border-collapse:collapse;overflow:hidden;">

          <!-- Header banner -->
          <tr>
            <td style="background:${BRAND.green};padding:28px 32px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="vertical-align:middle;width:64px;padding-right:16px;">
                    <img src="cid:${LOGO_CID}" alt="${escapeHtml(conference.logo.alt)}" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:9999px;background:${BRAND.white};object-fit:cover;border:2px solid rgba(255,255,255,0.35);" />
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.82);font-weight:600;">${escapeHtml(conference.shortName)}</p>
                    <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:${BRAND.white};line-height:1.3;">${escapeHtml(conference.organization)}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;font-size:22px;line-height:1.35;font-weight:700;color:${BRAND.white};">
                ${escapeHtml(headline)}
              </p>
            </td>
          </tr>

          <!-- Accent line -->
          <tr>
            <td style="height:4px;line-height:4px;font-size:0;background:${BRAND.greenLine};">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:${BRAND.white};padding:36px 32px 28px;">
              ${bodyHtml}
              ${emailCallout(
                "Managing your messages",
                `<p style="margin:0;">${escapeHtml(SPAM_NOTE)}</p>`
              )}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${BRAND.green};padding:28px 24px;text-align:center;">
              <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:${BRAND.greenLine};">
                ${escapeHtml(conference.organization)}
              </p>
              <p style="margin:0 0 12px;font-size:12px;line-height:1.7;color:rgba(255,255,255,0.88);">
                <a href="mailto:${escapeHtml(contactEmail)}" style="color:${BRAND.white};text-decoration:underline;">${escapeHtml(contactEmail)}</a>
                &nbsp;|&nbsp;
                ${escapeHtml(phone)}
              </p>
              <p style="margin:0;font-size:12px;line-height:1.7;color:rgba(255,255,255,0.78);">
                <span style="color:${BRAND.greenLine};font-weight:600;">${escapeHtml(venue.city)}</span><br />
                ${escapeHtml(venue.name)}, ${escapeHtml(venue.address)}
              </p>
              <p style="margin:16px 0 0;font-size:11px;color:rgba(255,255,255,0.55);">
                <a href="${escapeHtml(siteUrl)}" style="color:rgba(255,255,255,0.7);text-decoration:underline;">Visit our website</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendBrandedMail(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}): Promise<{ ok: boolean; error?: string }> {
  const logo = await getLogoAttachment();
  const attachments = [
    ...(logo ? [logo] : []),
    ...(payload.attachments ?? []),
  ];

  return sendMail({
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    replyTo: payload.replyTo,
    attachments,
  });
}

/** Sent immediately after registration — no QR until payment is confirmed. */
export async function sendRegistrationPendingEmail(
  registration: RegistrationRecord,
  event: EventContext
): Promise<{ ok: boolean; error?: string }> {
  const name = participantDisplayName(registration);
  const eventInfo = eventBlock(event);
  const subject = `Thank you for your interest: ${event.title}`;

  const html = wrapEmail({
    title: subject,
    headline: "Registration received! Next step is payment confirmation",
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:${BRAND.text};">
        Thank you for your interest in joining
        <strong>${escapeHtml(event.title)}</strong>. We have received your registration application.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 20px;border-collapse:collapse;">
        <tr>
          <td style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px 18px;">
            <p style="margin:0 0 6px;color:#92400e;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Application status</p>
            <p style="margin:0;color:#78350f;font-size:15px;line-height:1.6;">
              Your application is currently <strong>pending</strong>. Our secretariat will confirm your
              participation once we have received and verified your participation fee.
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:${BRAND.text};">
        Your reference number is <strong>${escapeHtml(registration.referenceNumber)}</strong>.
        Please keep this for payment and follow-up.
      </p>
      ${eventInfo.html}
      <p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:${BRAND.greenMuted};">
        After you submit your payment proof on the website, our staff will review it. Once confirmed,
        you will receive a separate email with your official event check-in QR code.
      </p>
    `,
  });

  const text = [
    `Hi ${name},`,
    "",
    `Thank you for your interest in joining ${event.title}. We have received your registration application.`,
    "",
    "Your application is currently pending. Our secretariat will confirm your participation once we have received and verified your participation fee.",
    "",
    `Reference number: ${registration.referenceNumber}`,
    "",
    eventInfo.text,
    "",
    "After you submit your payment proof on the website, our staff will review it. Once confirmed, you will receive a separate email with your official event check-in QR code.",
    "",
    SPAM_NOTE,
  ].join("\n");

  return sendBrandedMail({ to: registration.email, subject, html, text });
}

/** Sent when admin marks payment as paid — includes the unique check-in QR. */
export async function sendPaymentConfirmedEmail(
  registration: RegistrationRecord,
  event: EventContext
): Promise<{ ok: boolean; error?: string }> {
  if (!registration.checkInToken) {
    return { ok: false, error: "Missing check-in token on registration." };
  }

  const name = participantDisplayName(registration);
  const eventInfo = eventBlock(event);
  const qr = qrBlock(registration.checkInToken);
  const subject = `We're glad you're joining: ${event.title}`;

  const html = wrapEmail({
    title: subject,
    headline: "Your expertise matters! We're glad you'll be with us",
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:${BRAND.text};">
        Great News! Your participation fee has been confirmed. We’re glad you’ll be joining us for
        <strong>${escapeHtml(event.title)}</strong>.
      </p>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:${BRAND.text};">
        Your reference number is <strong>${escapeHtml(registration.referenceNumber)}</strong>.
      </p>
      ${eventInfo.html}
      ${qr.html}
      <p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:${BRAND.greenMuted};">
        Please keep this email handy and show your QR code at the front desk on event day for check-in.
      </p>
    `,
  });

  const text = [
    `Hi ${name},`,
    "",
    `Great News! Your participation fee has been confirmed. We're glad you'll be joining us for ${event.title}.`,
    `Reference number: ${registration.referenceNumber}`,
    "",
    eventInfo.text,
    "",
    qr.text,
    "",
    SPAM_NOTE,
  ].join("\n");

  return sendBrandedMail({ to: registration.email, subject, html, text });
}

export async function sendPaymentRejectedEmail(
  registration: RegistrationRecord,
  event: EventContext,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  return sendReceiptReuploadEmail(registration, event, reason, "rejected");
}

export async function sendReceiptIssueEmail(
  registration: RegistrationRecord,
  event: EventContext,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  return sendReceiptReuploadEmail(registration, event, reason, "receipt_issue");
}

async function sendReceiptReuploadEmail(
  registration: RegistrationRecord,
  event: EventContext,
  reason: string,
  kind: "rejected" | "receipt_issue"
): Promise<{ ok: boolean; error?: string }> {
  const name = participantDisplayName(registration);
  const eventInfo = eventBlock(event);
  const trimmedReason = reason.trim() || "Please upload a clearer payment receipt.";
  const reuploadToken = createReceiptReuploadToken(registration.referenceNumber);
  const reuploadUrl = `${getSiteBaseUrl()}/receipt-reupload?t=${encodeURIComponent(reuploadToken)}`;
  const isRejected = kind === "rejected";
  const statusLabel = isRejected ? "rejected" : "flagged for review";
  const subject = isRejected
    ? `Payment proof rejected: ${event.title}`
    : `Receipt issue: please reupload for ${event.title}`;
  const headline = isRejected
    ? "Action needed on your payment proof"
    : "Please reupload your payment receipt";

  const html = wrapEmail({
    title: subject,
    headline,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:${BRAND.text};">
        Your payment proof for <strong>${escapeHtml(registration.referenceNumber)}</strong> was
        <strong style="color:#b91c1c;">${statusLabel}</strong>.
      </p>
      ${eventInfo.html}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 8px;border-collapse:collapse;">
        <tr>
          <td style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px 18px;">
            <p style="margin:0 0 6px;color:#991b1b;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Message from secretariat</p>
            <p style="margin:0;color:#7f1d1d;font-size:15px;line-height:1.6;">${escapeHtml(trimmedReason)}</p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:${BRAND.greenMuted};">
        Your registration details are still on file. Open the secure link below to confirm your name and upload a clearer receipt,
        or contact the secretariat at ${escapeHtml(conference.contact.registrationEmail)}.
      </p>
      ${emailCta(reuploadUrl, "Reupload payment receipt")}
    `,
  });

  const text = [
    `Hi ${name},`,
    "",
    `Your payment proof for ${registration.referenceNumber} was ${statusLabel}.`,
    "",
    eventInfo.text,
    "",
    `Message from secretariat: ${trimmedReason}`,
    "",
    "Your registration details are still on file. Use this link to reupload a clearer receipt:",
    reuploadUrl,
    "",
    `Or contact ${conference.contact.registrationEmail}.`,
    "",
    SPAM_NOTE,
  ].join("\n");

  return sendBrandedMail({ to: registration.email, subject, html, text });
}

export async function sendEventReminderEmail(
  registration: RegistrationRecord,
  event: EventContext,
  window: ReminderWindow,
  eventStartIso: string
): Promise<{ ok: boolean; error?: string }> {
  if (!registration.checkInToken) {
    return { ok: false, error: "Missing check-in token on registration." };
  }

  const name = participantDisplayName(registration);
  const eventInfo = eventBlock(event);
  const qr = qrBlock(registration.checkInToken);
  const longDate = formatLongDate(eventStartIso);

  const copy: Record<ReminderWindow, { subject: string; intro: string; headline: string }> = {
    "3d": {
      subject: `Reminder: ${event.title} is in 3 days`,
      intro: `Friendly reminder! ${event.title} begins in 3 days (${longDate}). We’re looking forward to seeing you.`,
      headline: "Your event starts in 3 days",
    },
    "2d": {
      subject: `Reminder: ${event.title} is in 2 days`,
      intro: `Just 2 days to go until ${event.title} (${longDate}). Please prepare your check-in QR for the front desk.`,
      headline: "Your event starts in 2 days",
    },
    "0d": {
      subject: `Today: ${event.title}`,
      intro: `Today is the day! Welcome to ${event.title} (${longDate}). Show your QR code at the front desk when you arrive.`,
      headline: "Today is the day! Welcome",
    },
  };

  const { subject, intro, headline } = copy[window];

  const html = wrapEmail({
    title: subject,
    headline,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:${BRAND.text};">${escapeHtml(intro)}</p>
      ${eventInfo.html}
      ${qr.html}
    `,
  });

  const text = [
    `Hi ${name},`,
    "",
    intro,
    "",
    eventInfo.text,
    "",
    qr.text,
    "",
    SPAM_NOTE,
  ].join("\n");

  return sendBrandedMail({ to: registration.email, subject, html, text });
}

export async function sendPostEventEvaluationInviteEmail(
  registration: RegistrationRecord,
  event: EventContext
): Promise<{ ok: boolean; error?: string }> {
  const name = participantDisplayName(registration);
  const eventInfo = eventBlock(event);
  const evaluationUrl = `${getSiteBaseUrl()}/evaluation?t=${encodeURIComponent(registration.checkInToken)}`;
  const subject = `We value your feedback: ${event.title}`;

  const html = wrapEmail({
    title: subject,
    headline: "Share your feedback! Unlock your certificate",
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:${BRAND.text};">
        Thank you for attending <strong>${escapeHtml(event.title)}</strong>.
        We hope you had a meaningful experience.
      </p>
      ${eventInfo.html}
      <p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:${BRAND.text};">
        Please complete the post-event evaluation form. Your certificate of participation will be sent after submission.
      </p>
      ${emailCta(evaluationUrl, "Complete Evaluation")}
    `,
  });

  const text = [
    `Hi ${name},`,
    "",
    `Thank you for attending ${event.title}.`,
    "Please complete the post-event evaluation form.",
    "Your certificate of participation will be sent after submission.",
    "",
    `Evaluation link: ${evaluationUrl}`,
    "",
    eventInfo.text,
    "",
    SPAM_NOTE,
  ].join("\n");

  return sendBrandedMail({ to: registration.email, subject, html, text });
}

export async function sendCertificateEmail(
  registration: RegistrationRecord,
  event: EventContext
): Promise<{ ok: boolean; error?: string }> {
  const name = participantDisplayName(registration);
  const template = await getCertificateTemplate(event.id);
  const context = buildCertificateRenderContext(registration, event);
  const subject = renderCertificateSubject(template, context);

  let pdf: Buffer;
  try {
    pdf = await generateCertificatePdf(template, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate certificate PDF.";
    return { ok: false, error: message };
  }

  const html = wrapEmail({
    title: subject,
    headline: "Your certificate of participation is ready",
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:${BRAND.text};">
        Thank you for completing the post-event evaluation. Your certificate of participation is attached as a PDF.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:${BRAND.greenMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Event</td></tr>
        <tr><td style="padding:2px 0 12px;color:${BRAND.green};font-size:17px;font-weight:700;">${escapeHtml(context.event)}</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.greenMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Certificate No</td></tr>
        <tr><td style="padding:2px 0 12px;color:${BRAND.text};font-size:15px;">${escapeHtml(context.certificateId)}</td></tr>
        <tr><td style="padding:4px 0;color:${BRAND.greenMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Issued</td></tr>
        <tr><td style="padding:2px 0;color:${BRAND.text};font-size:15px;">${escapeHtml(context.issuedAt)}</td></tr>
      </table>
      <p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:${BRAND.greenMuted};">
        Open the attached PDF to view, print, or save your certificate.
      </p>
    `,
  });

  const text = [
    `Hi ${name},`,
    "",
    "Thank you for completing the post-event evaluation.",
    "Your certificate of participation is attached as a PDF.",
    "",
    `Event: ${context.event}`,
    `Certificate No: ${context.certificateId}`,
    `Issued: ${context.issuedAt}`,
    "",
    SPAM_NOTE,
  ].join("\n");

  return sendBrandedMail({
    to: registration.email,
    subject,
    html,
    text,
    attachments: [
      {
        filename: `certificate-${context.reference}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });
}

export async function sendUpcomingEventPromotionEmail(
  registration: RegistrationRecord,
  upcomingEvent: EventContext
): Promise<{ ok: boolean; error?: string }> {
  const name = participantDisplayName(registration);
  const eventInfo = eventBlock(upcomingEvent);
  const registerUrl = `${getSiteBaseUrl()}/?register=1&event=${encodeURIComponent(upcomingEvent.id)}`;
  const subject = `Upcoming Event Invitation: ${upcomingEvent.title}`;

  const html = wrapEmail({
    title: subject,
    headline: "You're invited! Join our next gathering",
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:${BRAND.text};">
        Thank you for joining one of our previous events. We’re pleased to invite you to our upcoming event.
      </p>
      ${eventInfo.html}
      <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:${BRAND.greenMuted};">
        We’d be honored to have you again. Early registration is encouraged.
      </p>
      ${emailCta(registerUrl, "Register for this Event")}
    `,
  });

  const text = [
    `Hi ${name},`,
    "",
    "Thank you for joining one of our previous events.",
    "We’re pleased to invite you to our upcoming event:",
    "",
    eventInfo.text,
    "",
    `Register link: ${registerUrl}`,
    "",
    SPAM_NOTE,
  ].join("\n");

  return sendBrandedMail({ to: registration.email, subject, html, text });
}

export type AdminInquiryEmailPayload = {
  name: string;
  email: string;
  mobile: string;
  message: string;
  inquiryId?: string;
  createdAt?: string;
};

/** Alerts the secretariat when someone submits the public contact form. */
export async function sendAdminInquiryNotification(
  payload: AdminInquiryEmailPayload
): Promise<{ ok: boolean; error?: string }> {
  const to = process.env.ADMIN_NOTIFY_EMAIL?.trim() || conference.contact.email;
  const subject = `New PNA website inquiry from ${payload.name}`;
  const adminUrl = `${getSiteBaseUrl()}/admin/inquiries`;

  const html = wrapEmail({
    title: subject,
    headline: "New contact inquiry received",
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:${BRAND.text};">
        A visitor submitted the contact form on the PNA website. Reply directly to this email to
        respond to the inquirer.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border-collapse:collapse;">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.greenMuted};">Name</p>
            <p style="margin:0;font-size:15px;color:${BRAND.text};">${escapeHtml(payload.name)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.greenMuted};">Email</p>
            <p style="margin:0;font-size:15px;color:${BRAND.text};">${escapeHtml(payload.email)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.greenMuted};">Mobile</p>
            <p style="margin:0;font-size:15px;color:${BRAND.text};">${escapeHtml(payload.mobile)}</p>
          </td>
        </tr>
        ${
          payload.inquiryId
            ? `<tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.greenMuted};">Inquiry ID</p>
            <p style="margin:0;font-size:15px;color:${BRAND.text};">${escapeHtml(payload.inquiryId)}</p>
          </td>
        </tr>`
            : ""
        }
      </table>
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.greenMuted};">Message</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.75;color:${BRAND.text};white-space:pre-wrap;">${escapeHtml(payload.message)}</p>
      ${emailCta(adminUrl, "Open admin inquiries")}
    `,
  });

  const text = [
    "New contact inquiry received on the PNA website.",
    "",
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Mobile: ${payload.mobile}`,
    payload.inquiryId ? `Inquiry ID: ${payload.inquiryId}` : null,
    payload.createdAt ? `Submitted: ${payload.createdAt}` : null,
    "",
    "Message:",
    payload.message,
    "",
    `Admin inbox: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendBrandedMail({
    to,
    subject,
    html,
    text,
    replyTo: payload.email,
  });
}

export type AdminReceiptSubmittedPayload = {
  registration: RegistrationRecord;
  eventTitle: string;
  isReupload: boolean;
};

/** Alerts the secretariat when a participant submits (or re-submits) payment proof. */
export async function sendAdminReceiptSubmittedNotification(
  payload: AdminReceiptSubmittedPayload
): Promise<{ ok: boolean; error?: string }> {
  const to = process.env.ADMIN_NOTIFY_EMAIL?.trim() || conference.contact.email;
  const name = participantDisplayName(payload.registration);
  const adminUrl = `${getSiteBaseUrl()}/admin/participants`;
  const kindLabel = payload.isReupload ? "re-uploaded" : "uploaded";
  const subject = `Payment receipt ${kindLabel}: ${payload.registration.referenceNumber}`;

  const html = wrapEmail({
    title: subject,
    headline: payload.isReupload
      ? "Payment receipt re-uploaded"
      : "New payment receipt submitted",
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:${BRAND.text};">
        <strong>${escapeHtml(name)}</strong> ${kindLabel} payment proof for
        <strong>${escapeHtml(payload.registration.referenceNumber)}</strong>
        (${escapeHtml(payload.eventTitle)}). Review it in the admin participants panel.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border-collapse:collapse;">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.greenMuted};">Participant</p>
            <p style="margin:0;font-size:15px;color:${BRAND.text};">${escapeHtml(name)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.greenMuted};">Email</p>
            <p style="margin:0;font-size:15px;color:${BRAND.text};">${escapeHtml(payload.registration.email)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.greenMuted};">Reference</p>
            <p style="margin:0;font-size:15px;color:${BRAND.text};">${escapeHtml(payload.registration.referenceNumber)}</p>
          </td>
        </tr>
      </table>
      ${emailCta(adminUrl, "Open participants")}
    `,
  });

  const text = [
    `A participant ${kindLabel} payment proof.`,
    "",
    `Participant: ${name}`,
    `Email: ${payload.registration.email}`,
    `Reference: ${payload.registration.referenceNumber}`,
    `Event: ${payload.eventTitle}`,
    "",
    `Admin: ${adminUrl}`,
  ].join("\n");

  return sendBrandedMail({ to, subject, html, text });
}
