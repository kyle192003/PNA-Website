import { NextResponse } from "next/server";
import { conference } from "@/lib/conference";
import { getRegistrationSidebarEvent } from "@/lib/events";
import { countEarlyBirdUsed } from "@/lib/registrations";
import { getFeesForEvent, isEarlyBirdAvailable } from "@/lib/registration-fees";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const event = await getRegistrationSidebarEvent(eventId);

  if (!event) {
    return NextResponse.json({ event: null });
  }

  const fees = getFeesForEvent(event);
  const earlyBirdUsed = await countEarlyBirdUsed(event.id);
  const earlyBirdAvailable = isEarlyBirdAvailable(fees, earlyBirdUsed, event);

  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      datesDisplay: event.datesDisplay,
      venueName: event.venueName,
      earlyBirdDeadline: event.earlyBirdDeadline,
      fees: event.fees,
      earlyBirdAvailable,
      qrCodeUrl: event.showQrInRegistration ? event.qrCodeUrl : null,
      bankTransfer: conference.registration.bankTransfer,
    },
  });
}
