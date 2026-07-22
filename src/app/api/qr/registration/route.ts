import { NextResponse } from "next/server";
import { getEventById } from "@/lib/events";
import { ensureEventRegistrationQr } from "@/lib/registration-qr";
import { getSiteBaseUrl } from "@/lib/site-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  try {
    const details = await ensureEventRegistrationQr(eventId, {
      baseUrl: getSiteBaseUrl(),
    });

    if (!details) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    return NextResponse.json(details);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate registration QR code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
