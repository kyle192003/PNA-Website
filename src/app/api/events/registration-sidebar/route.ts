import { NextResponse } from "next/server";
import { conference } from "@/lib/conference";
import { getRegistrationSidebarEvent } from "@/lib/events";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const event = await getRegistrationSidebarEvent(eventId);

  if (!event) {
    return NextResponse.json({ event: null });
  }

  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      datesDisplay: event.datesDisplay,
      venueName: event.venueName,
      earlyBirdDeadline: event.earlyBirdDeadline,
      fees: event.fees,
      qrCodeUrl: event.showQrInRegistration ? event.qrCodeUrl : null,
      bankTransfer: conference.registration.bankTransfer,
    },
  });
}
