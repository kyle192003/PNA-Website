import { NextResponse } from "next/server";
import { formatParticipantName } from "@/lib/participant-name";
import { verifyReceiptReuploadToken } from "@/lib/receipt-reupload-token";
import { getRegistrationByReference } from "@/lib/registrations";
import { PAYMENT_STATUS_LABELS } from "@/lib/types/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("t");
  const verified = verifyReceiptReuploadToken(token);

  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const registration = await getRegistrationByReference(verified.referenceNumber);
  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  const canUpload =
    registration.paymentStatus === "pending" ||
    registration.paymentStatus === "receipt_issue" ||
    registration.paymentStatus === "rejected" ||
    registration.paymentStatus === "receipt_submitted";

  return NextResponse.json({
    referenceNumber: registration.referenceNumber,
    name: formatParticipantName(registration),
    firstName: registration.firstName,
    lastName: registration.lastName,
    middleInitial: registration.middleInitial ?? "",
    email: registration.email,
    organization: registration.organization,
    paymentStatus: registration.paymentStatus,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[registration.paymentStatus],
    paymentNotes: registration.paymentNotes ?? "",
    canUpload,
  });
}
