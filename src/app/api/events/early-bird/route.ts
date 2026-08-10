import { NextResponse } from "next/server";
import { getEventById, getActiveEvent } from "@/lib/events";
import { countEarlyBirdUsed } from "@/lib/registrations";
import {
  getEarlyBirdCap,
  getEarlyBirdCaption,
  getEarlyBirdMode,
  getEarlyBirdWindowEnd,
  getEarlyBirdWindowStart,
  getFeesForEvent,
  isEarlyBirdAvailable,
} from "@/lib/registration-fees";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const event = eventId ? await getEventById(eventId) : await getActiveEvent();
  const fees = getFeesForEvent(event);
  const used = await countEarlyBirdUsed(event?.id ?? null);
  const mode = getEarlyBirdMode(fees);
  const cap = getEarlyBirdCap(fees);
  const available = isEarlyBirdAvailable(fees, used, event);
  const remaining =
    mode === "slots" ? Math.max(0, cap - used) : available ? Number.POSITIVE_INFINITY : 0;

  return NextResponse.json({
    mode,
    used,
    cap: mode === "slots" ? cap : null,
    remaining: Number.isFinite(remaining) ? remaining : null,
    available,
    windowStart: getEarlyBirdWindowStart(fees) ?? null,
    windowEnd: getEarlyBirdWindowEnd(fees, event) ?? null,
    caption: getEarlyBirdCaption(fees, event),
    earlyBirdAmount: fees.earlyBird.amount,
    regularAmount: fees.regular.amount,
    seniorPwdAmount: fees.seniorPwd.amount,
  });
}
