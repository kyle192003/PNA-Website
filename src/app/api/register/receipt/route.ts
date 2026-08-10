import { NextResponse } from "next/server";
import { getEventById } from "@/lib/events";
import { sendAdminReceiptSubmittedNotification } from "@/lib/mail-templates";
import { verifyReceiptReuploadToken } from "@/lib/receipt-reupload-token";
import { emailsMatch } from "@/lib/security/email";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { getRegistrationByReference, submitReceipt } from "@/lib/registrations";
import { saveReceipt } from "@/lib/uploads";

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = rateLimit(`receipt:${ip}`, 20, 60_000);
    if (!limited.ok) {
      return rateLimitResponse(limited.retryAfterSeconds);
    }

    const formData = await request.formData();
    const token = formData.get("token")?.toString().trim();
    const referenceFromForm = formData.get("referenceNumber")?.toString().trim();
    const emailFromForm = formData.get("email")?.toString().trim() ?? "";
    const paymentReference = formData.get("paymentReference")?.toString().trim() ?? "";
    const file = formData.get("file");

    let referenceNumber = referenceFromForm?.toUpperCase() ?? "";
    const isReupload = Boolean(token);

    if (token) {
      const verified = verifyReceiptReuploadToken(token);
      if (!verified.ok) {
        return NextResponse.json({ error: verified.error }, { status: 400 });
      }
      referenceNumber = verified.referenceNumber;
    }

    if (!referenceNumber) {
      return NextResponse.json({ error: "Reference number is required." }, { status: 400 });
    }

    if (!token && !emailFromForm) {
      return NextResponse.json(
        { error: "Email address is required to upload a receipt." },
        { status: 400 }
      );
    }

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Receipt file is required." }, { status: 400 });
    }

    if (!paymentReference || paymentReference.length < 4) {
      return NextResponse.json(
        { error: "Payment reference from your receipt is required." },
        { status: 400 }
      );
    }

    const registration = await getRegistrationByReference(referenceNumber);
    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    if (!token && !emailsMatch(registration.email, emailFromForm)) {
      return NextResponse.json(
        { error: "No registration matched that reference number and email." },
        { status: 404 }
      );
    }

    if (registration.paymentStatus === "paid") {
      return NextResponse.json(
        { error: "This registration is already marked as paid." },
        { status: 400 }
      );
    }

    const wasIssueOrRejected =
      registration.paymentStatus === "receipt_issue" ||
      registration.paymentStatus === "rejected";

    const receiptUrl = await saveReceipt(registration.id, file);
    const updated = await submitReceipt(referenceNumber, receiptUrl, { paymentReference });

    const event = updated?.eventId ? await getEventById(updated.eventId) : null;
    const eventTitle = event?.title ?? "PNA Conference Registration";
    const mailResult = await sendAdminReceiptSubmittedNotification({
      registration: updated ?? registration,
      eventTitle,
      isReupload: isReupload || wasIssueOrRejected,
    });
    if (!mailResult.ok) {
      console.error("[receipt] admin notification failed:", mailResult.error);
    }

    return NextResponse.json({
      message: "Receipt submitted for review.",
      paymentStatus: updated?.paymentStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload receipt.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
