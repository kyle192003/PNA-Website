import { NextResponse } from "next/server";
import { verifyReceiptReuploadToken } from "@/lib/receipt-reupload-token";
import { submitReceipt } from "@/lib/registrations";
import { saveReceipt } from "@/lib/uploads";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const token = formData.get("token")?.toString().trim();
    const referenceFromForm = formData.get("referenceNumber")?.toString().trim();
    const file = formData.get("file");

    let referenceNumber = referenceFromForm?.toUpperCase() ?? "";

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

    const { getRegistrationByReference } = await import("@/lib/registrations");
    const registration = await getRegistrationByReference(referenceNumber);
    if (!registration) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    const receiptUrl = await saveReceipt(registration.id, file);
    const updated = await submitReceipt(referenceNumber, receiptUrl);

    return NextResponse.json({
      message: "Receipt submitted for review.",
      paymentStatus: updated?.paymentStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload receipt.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
