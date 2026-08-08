import { NextResponse } from "next/server";
import { emailsMatch, maskEmail } from "@/lib/security/email";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { getRegistrationByReference } from "@/lib/registrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = clientIpFromRequest(request);
  const limited = rateLimit(`lookup:${ip}`, 30, 60_000);
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfterSeconds);
  }

  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference")?.trim().toUpperCase() ?? "";
  const email = searchParams.get("email")?.trim() ?? "";

  if (!reference) {
    return NextResponse.json(
      { error: "Reference number is required." },
      { status: 400 }
    );
  }

  if (!email) {
    return NextResponse.json(
      { error: "Email address is required to look up a registration." },
      { status: 400 }
    );
  }

  const registration = await getRegistrationByReference(reference);

  // Same generic message whether missing or email mismatch (reduces enumeration).
  if (!registration || !emailsMatch(registration.email, email)) {
    return NextResponse.json(
      { error: "No registration matched that reference number and email." },
      { status: 404 }
    );
  }

  const canUpload =
    registration.paymentStatus === "pending" ||
    registration.paymentStatus === "receipt_issue" ||
    registration.paymentStatus === "rejected" ||
    registration.paymentStatus === "receipt_submitted";

  return NextResponse.json({
    referenceNumber: registration.referenceNumber,
    firstName: registration.firstName,
    lastName: registration.lastName,
    middleInitial: registration.middleInitial,
    emailMasked: maskEmail(registration.email),
    organization: registration.organization,
    category: registration.category,
    paymentStatus: registration.paymentStatus,
    paymentNotes: registration.paymentNotes,
    hasReceipt: Boolean(registration.receiptUrl),
    canUpload,
    createdAt: registration.createdAt,
  });
}
