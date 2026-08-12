import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
  /** Content-ID for inline images (referenced as cid:... in HTML). */
  cid?: string;
  contentDisposition?: "inline" | "attachment";
};

type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: MailAttachment[];
};

let transporter: Transporter | null = null;

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransporter(): Transporter | null {
  if (!isMailConfigured()) return null;

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? "587");
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  }

  return transporter;
}

/**
 * Sends email if SMTP is configured. Never throws to callers —
 * logs failures and returns { ok: false }.
 */
export async function sendMail(
  payload: MailPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mailer = getTransporter();
  if (!mailer) {
    const message = "Mail is not configured (set SMTP_HOST and SMTP_FROM).";
    console.warn(`[mail] skipped to=${payload.to} subject="${payload.subject}": ${message}`);
    return { ok: false, error: message };
  }

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM,
      to: payload.to,
      replyTo: payload.replyTo,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      attachments: payload.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        cid: attachment.cid,
        contentDisposition:
          attachment.contentDisposition ??
          (attachment.cid ? "inline" : "attachment"),
      })),
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown mail error";
    console.error(`[mail] failed to=${payload.to} subject="${payload.subject}":`, message);
    return { ok: false, error: message };
  }
}
