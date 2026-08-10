import { NextResponse } from "next/server";
import { getEventById, getActiveEvent } from "@/lib/events";
import { countEarlyBirdUsed } from "@/lib/registrations";
import {
  getEarlyBirdCap,
  getEarlyBirdCaption,
  getEarlyBirdWindowEnd,
  getEarlyBirdWindowStart,
  getFeesForEvent,
  getSeniorPwdAmount,
  isEarlyBirdAvailable,
} from "@/lib/registration-fees";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const event = eventId ? await getEventById(eventId) : await getActiveEvent();
  const fees = getFeesForEvent(event);
  const used = await countEarlyBirdUsed(event?.id ?? null);
  const cap = getEarlyBirdCap(fees);
  const available = isEarlyBirdAvailable(fees, used, event);
  const remaining = Math.max(0, cap - used);

  return NextResponse.json({
    /** Combined slots + date window (legacy field kept for clients). */
    mode: "slots_and_dates",
    used,
    cap,
    remaining,
    available,
    /** Senior/PWD is only offered after early bird ends. */
    seniorPwdAvailable: !available,
    windowStart: getEarlyBirdWindowStart(fees) ?? null,
    windowEnd: getEarlyBirdWindowEnd(fees, event) ?? null,
    caption: getEarlyBirdCaption(fees, event),
    earlyBirdAmount: fees.earlyBird.amount,
    regularAmount: fees.regular.amount,
    seniorPwdAmount: getSeniorPwdAmount(fees),
  });
}
