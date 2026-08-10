import { NextResponse } from "next/server";
import { getEventById } from "@/lib/events";
import { getSpecialInviteByToken } from "@/lib/special-invites";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const limited = rateLimit(`invite-lookup:${clientIpFromRequest(request)}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSeconds);

  const { token } = await context.params;
  const invite = await getSpecialInviteByToken(decodeURIComponent(token));
  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  const event = await getEventById(invite.eventId);

  return NextResponse.json({
    invite: {
      email: invite.email,
      eventId: invite.eventId,
      eventTitle: event?.title ?? "Conference event",
      status: invite.status,
    },
  });
}
