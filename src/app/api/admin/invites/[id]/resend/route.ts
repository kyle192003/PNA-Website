import { NextResponse } from "next/server";
import { getEventById } from "@/lib/events";
import { isMailConfigured } from "@/lib/mail";
import {
  sendComplimentaryInviteConfirmedEmail,
  sendSpecialInviteEmail,
} from "@/lib/mail-templates";
import { getRegistrationById } from "@/lib/registrations";
import {
  buildSpecialInviteUrl,
  getSpecialInviteById,
  markSpecialInviteSent,
} from "@/lib/special-invites";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const invite = await getSpecialInviteById(id);
  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (invite.status === "revoked") {
    return NextResponse.json(
      { error: "Revoked invites cannot be resent." },
      { status: 400 }
    );
  }

  const event = await getEventById(invite.eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  if (!isMailConfigured()) {
    return NextResponse.json(
      { error: "Email is not configured on this server." },
      { status: 503 }
    );
  }

  const inviteUrl = buildSpecialInviteUrl(invite.token);
  const eventContext = {
    id: event.id,
    title: event.title,
    datesDisplay: event.datesDisplay,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    venueMapsUrl: event.venueMapsUrl,
  };

  let mail;
  let mailKind: "invite" | "confirmation";

  if (invite.status === "used") {
    if (!invite.usedByRegistrationId) {
      return NextResponse.json(
        { error: "Registration record for this invite was not found." },
        { status: 400 }
      );
    }

    const registration = await getRegistrationById(invite.usedByRegistrationId);
    if (!registration) {
      return NextResponse.json(
        { error: "Registration record for this invite was not found." },
        { status: 404 }
      );
    }

    mail = await sendComplimentaryInviteConfirmedEmail(registration, eventContext);
    mailKind = "confirmation";
  } else {
    mail = await sendSpecialInviteEmail({
      to: invite.email,
      firstName: invite.firstName,
      specialRole: invite.specialRole,
      eventTitle: event.title,
      inviteUrl,
      note: invite.note || undefined,
    });
    mailKind = "invite";
  }

  if (!mail.ok) {
    return NextResponse.json(
      { error: mail.error || "Failed to send email." },
      { status: 502 }
    );
  }

  const updated = (await markSpecialInviteSent(invite.id)) ?? invite;
  return NextResponse.json({
    invite: {
      ...updated,
      eventTitle: event.title,
      inviteUrl,
    },
    mailSent: true,
    mailKind,
  });
}
