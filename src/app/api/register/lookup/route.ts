import { NextResponse } from "next/server";
import { getRegistrationByReference } from "@/lib/registrations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.json(
      { error: "Reference number is required." },
      { status: 400 }
    );
  }

  const registration = await getRegistrationByReference(reference);

  if (!registration) {
    return NextResponse.json(
      { error: "Registration not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    referenceNumber: registration.referenceNumber,
    firstName: registration.firstName,
    lastName: registration.lastName,
    middleInitial: registration.middleInitial,
    email: registration.email,
    organization: registration.organization,
    category: registration.category,
    paymentStatus: registration.paymentStatus,
    paymentNotes: registration.paymentNotes,
    receiptUrl: registration.receiptUrl,
    createdAt: registration.createdAt,
  });
}
