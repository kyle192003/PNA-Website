import { NextResponse } from "next/server";
import { getEventById } from "@/lib/events";
import {
  buildSpecialInviteUrl,
  revokeSpecialInvite,
} from "@/lib/special-invites";
import { requireAdminSession } from "@/lib/security/require-admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const invite = await revokeSpecialInvite(id);
    if (!invite) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }

    const event = await getEventById(invite.eventId);
    return NextResponse.json({
      invite: {
        ...invite,
        eventTitle: event?.title ?? "Unknown event",
        inviteUrl: buildSpecialInviteUrl(invite.token),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not revoke invite." },
      { status: 400 }
    );
  }
}
