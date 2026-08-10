import { NextResponse } from "next/server";
import { getEventById, getActiveEvent } from "@/lib/events";
import { countEarlyBirdUsed } from "@/lib/registrations";
import { getEarlyBirdCap, getFeesForEvent } from "@/lib/registration-fees";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const event = eventId ? await getEventById(eventId) : await getActiveEvent();
  const fees = getFeesForEvent(event);
  const used = await countEarlyBirdUsed(event?.id ?? null);
  const cap = getEarlyBirdCap(fees);

  return NextResponse.json({
    used,
    cap,
    remaining: Math.max(0, cap - used),
    earlyBirdAmount: fees.earlyBird.amount,
    regularAmount: fees.regular.amount,
    seniorPwdAmount: fees.seniorPwd.amount,
  });
}
