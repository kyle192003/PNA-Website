import { NextResponse } from "next/server";
import { getRegistrationById } from "@/lib/registrations";
import { toAccountantReviewItem } from "@/lib/accountant-review";
import { applyPaymentStatusChange, isPaymentStatus } from "@/lib/payment-status-actions";
import { RECEIPT_ISSUE_REASONS } from "@/lib/receipt-issue-reasons";
import { readJsonBody, stringField } from "@/lib/security/safe-input";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { authorizeAccountantToken, tokenFromSearch } from "@/lib/accountant-share";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await authorizeAccountantToken(tokenFromSearch(request));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const registration = await getRegistrationById(id?.trim() ?? "");
  if (!registration) {
    return NextResponse.json({ error: "Participant not found." }, { status: 404 });
  }

  return NextResponse.json({ item: await toAccountantReviewItem(registration) });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const ip = clientIpFromRequest(request);
  const limited = rateLimit(`accountant-review:${ip}`, 30, 60_000);
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfterSeconds);
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const auth = await authorizeAccountantToken(
    tokenFromSearch(request, stringField(parsed.data.token))
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Participant id is required." }, { status: 400 });
  }

  const paymentStatusRaw = stringField(parsed.data.paymentStatus);
  if (!isPaymentStatus(paymentStatusRaw) || (paymentStatusRaw !== "paid" && paymentStatusRaw !== "receipt_issue")) {
    return NextResponse.json(
      { error: "Accountant review can only approve payment or reject it with a reason." },
      { status: 400 }
    );
  }

  const paymentNotes = stringField(parsed.data.paymentNotes)?.trim() ?? "";
  if (paymentStatusRaw === "receipt_issue") {
    const allowed =
      (RECEIPT_ISSUE_REASONS as readonly string[]).includes(paymentNotes) || paymentNotes.length >= 8;
    if (!allowed) {
      return NextResponse.json(
        { error: "Choose a rejection reason before continuing." },
        { status: 400 }
      );
    }
  }

  const result = await applyPaymentStatusChange({
    registrationId: id.trim(),
    paymentStatus: paymentStatusRaw,
    paymentNotes: paymentStatusRaw === "receipt_issue" ? paymentNotes : undefined,
    irreversiblePaid: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    item: await toAccountantReviewItem(result.registration),
    message:
      paymentStatusRaw === "paid"
        ? "Payment approved. This cannot be undone from this link."
        : "Payment rejected. The participant was emailed a one-time reupload link.",
  });
}
