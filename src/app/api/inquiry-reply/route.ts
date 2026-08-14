import { NextResponse } from "next/server";
import { getEmailConfirmationError } from "@/lib/email-domain";
import {
  consumeInquiryShareReply,
  getPublicInquiryByShareToken,
} from "@/lib/inquiries";
import { verifyInquiryShareToken } from "@/lib/inquiry-share-token";
import { sendAdminInquiryShareReplyNotification } from "@/lib/mail-templates";
import {
  getFirstValidationError,
  validateInquiryShareReply,
} from "@/lib/form-validation";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { readJsonBody, stringField } from "@/lib/security/safe-input";

export const dynamic = "force-dynamic";

function tokenFromRequest(request: Request, bodyToken?: string): string | undefined {
  const { searchParams } = new URL(request.url);
  return searchParams.get("t")?.trim() || bodyToken?.trim() || undefined;
}

export async function GET(request: Request) {
  const verified = verifyInquiryShareToken(tokenFromRequest(request));
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const result = await getPublicInquiryByShareToken(verified.inquiryId, verified.nonce);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ inquiry: result.inquiry });
}

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limited = rateLimit(`inquiry-share-reply:${ip}`, 8, 60_000);
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfterSeconds);
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const token = tokenFromRequest(request, stringField(parsed.data.token));
  const verified = verifyInquiryShareToken(token);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const name = stringField(parsed.data.name) ?? "";
  const email = stringField(parsed.data.email) ?? "";
  const emailConfirm = stringField(parsed.data.emailConfirm) ?? "";
  const message = stringField(parsed.data.message) ?? "";

  const fieldErrors = validateInquiryShareReply({ name, email, message });
  const confirmError = getEmailConfirmationError(email, emailConfirm);
  if (confirmError && !fieldErrors.email) fieldErrors.email = confirmError;

  const firstError = getFirstValidationError(fieldErrors);
  if (firstError) {
    return NextResponse.json({ error: firstError, fieldErrors }, { status: 400 });
  }

  const result = await consumeInquiryShareReply({
    inquiryId: verified.inquiryId,
    nonce: verified.nonce,
    fromName: name,
    fromEmail: email,
    body: message,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const notify = await sendAdminInquiryShareReplyNotification({
    inquiryId: result.inquiry.id,
    inquiryName: result.inquiry.name,
    inquiryEmail: result.inquiry.email,
    originalMessage: result.inquiry.message,
    fromName: result.reply.fromName || name,
    fromEmail: result.reply.fromEmail || email,
    replyBody: result.reply.body,
  });
  if (!notify.ok) {
    console.error("[inquiry-reply] admin notify failed:", notify.error);
  }

  return NextResponse.json({
    message:
      "Your reply was submitted. This link has now expired. The secretariat will follow up by email.",
  });
}
