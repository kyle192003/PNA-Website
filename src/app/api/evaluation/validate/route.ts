import { NextResponse } from "next/server";
import { extractCheckInTokenFromScan } from "@/lib/check-in-qr";
import { formatParticipantName } from "@/lib/participant-name";
import { getRegistrationByCheckInToken } from "@/lib/registrations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("t") ?? searchParams.get("token") ?? "";
  const token = extractCheckInTokenFromScan(raw);

  if (!token) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid evaluation link. Please use the link sent in your email.",
      },
      { status: 400 }
    );
  }

  const registration = await getRegistrationByCheckInToken(token);
  if (!registration) {
    return NextResponse.json(
      { error: "This evaluation link is invalid or no longer valid." },
      { status: 404 }
    );
  }

  if (
    !registration.evaluationSubmittedAt &&
    registration.paymentStatus !== "paid"
  ) {
    return NextResponse.json(
      { error: "Evaluation is available after payment has been confirmed." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    alreadySubmitted: Boolean(registration.evaluationSubmittedAt),
    name: formatParticipantName(registration),
    referenceNumber: registration.referenceNumber,
  });
}
