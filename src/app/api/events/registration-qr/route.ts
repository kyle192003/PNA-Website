import { NextResponse } from "next/server";
import { getRegistrationQrEvent } from "@/lib/events";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const event = await getRegistrationQrEvent(eventId);

  if (!event) {
    return NextResponse.json({ event: null });
  }

  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      qrCodeUrl: event.qrCodeUrl,
    },
  });
}
