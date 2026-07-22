import { NextResponse } from "next/server";
import { getEventById } from "@/lib/events";
import { ensureEventRegistrationQr } from "@/lib/registration-qr";
import { getSiteBaseUrl } from "@/lib/site-url";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const event = await getEventById(id);

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  if (!event.registrationQrCodeUrl) {
    return NextResponse.json({
      event,
      eventId: event.id,
      eventTitle: event.title,
      registrationUrl: null,
      qrCodeUrl: null,
      quickChartUrl: null,
    });
  }

  try {
    const details = await ensureEventRegistrationQr(id, {
      baseUrl: getSiteBaseUrl(),
    });

    return NextResponse.json({ event, ...details });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load registration QR code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const event = await getEventById(id);

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  try {
    const details = await ensureEventRegistrationQr(id, {
      regenerate: true,
      baseUrl: getSiteBaseUrl(),
    });

    const updated = await getEventById(id);

    return NextResponse.json({
      event: updated,
      ...details,
      message: "Registration QR code regenerated.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to regenerate registration QR code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
