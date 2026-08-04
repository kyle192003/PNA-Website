import { NextResponse } from "next/server";
import { getEventById } from "@/lib/events";
import { sendAdminReceiptSubmittedNotification } from "@/lib/mail-templates";
import { verifyReceiptReuploadToken } from "@/lib/receipt-reupload-token";
import { getRegistrationByReference, submitReceipt } from "@/lib/registrations";
import { saveReceipt } from "@/lib/uploads";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const token = formData.get("token")?.toString().trim();
    const referenceFromForm = formData.get("referenceNumber")?.toString().trim();
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

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Receipt file is required." }, { status: 400 });
    }

    const registration = await getRegistrationByReference(referenceNumber);
    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    const wasIssueOrRejected =
      registration.paymentStatus === "receipt_issue" ||
      registration.paymentStatus === "rejected";

    const receiptUrl = await saveReceipt(registration.id, file);
    const updated = await submitReceipt(referenceNumber, receiptUrl);

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
