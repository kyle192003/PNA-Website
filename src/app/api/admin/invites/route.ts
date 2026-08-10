import { NextResponse } from "next/server";
import { getEventById, getAllEvents } from "@/lib/events";
import { isMailConfigured } from "@/lib/mail";
import { sendSpecialInviteEmail } from "@/lib/mail-templates";
import { getEmailValidationError } from "@/lib/form-validation";
import { getRegistrationById } from "@/lib/registrations";
import {
  buildSpecialInviteUrl,
  createSpecialInvite,
  getAllSpecialInvites,
  markSpecialInviteSent,
} from "@/lib/special-invites";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();
  const eventId = searchParams.get("eventId")?.trim();
  const query = searchParams.get("q")?.toLowerCase().trim();

  let invites = await getAllSpecialInvites();
  const events = await getAllEvents();
  const eventTitleById = new Map(events.map((event) => [event.id, event.title]));

  if (status === "pending" || status === "used" || status === "revoked") {
    invites = invites.filter((invite) => invite.status === status);
  }
  if (eventId) {
    invites = invites.filter((invite) => invite.eventId === eventId);
  }
  if (query) {
    invites = invites.filter((invite) => {
      const haystack = [invite.email, invite.note, eventTitleById.get(invite.eventId) ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  return NextResponse.json({
    invites: await Promise.all(
      invites.map(async (invite) => {
        const base = {
          ...invite,
          eventTitle: eventTitleById.get(invite.eventId) ?? "Unknown event",
          inviteUrl: buildSpecialInviteUrl(invite.token),
        };

        if (!invite.usedByRegistrationId) {
          return { ...base, registration: null };
        }

        const registration = await getRegistrationById(invite.usedByRegistrationId);
        if (!registration) {
          return { ...base, registration: null };
        }

        return {
          ...base,
          registration: {
            id: registration.id,
            referenceNumber: registration.referenceNumber,
            firstName: registration.firstName,
            lastName: registration.lastName,
            specialRole: registration.specialRole,
            registeredAt: registration.createdAt,
          },
        };
      })
    ),
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  const emailError = getEmailValidationError(email);
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 400 });
  }
  if (!eventId) {
    return NextResponse.json({ error: "Please select an event." }, { status: 400 });
  }

  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  try {
    let invite = await createSpecialInvite({ email, eventId, note });
    const inviteUrl = buildSpecialInviteUrl(invite.token);

    let mailSent = false;
    let mailError: string | undefined;

    if (!isMailConfigured()) {
      mailError = "Email is not configured. Invite was created; copy the link manually.";
    } else {
      const mail = await sendSpecialInviteEmail({
        to: invite.email,
        eventTitle: event.title,
        inviteUrl,
        note: invite.note || undefined,
      });
      mailSent = mail.ok;
      mailError = mail.ok ? undefined : mail.error || "Failed to send invite email.";
      if (mail.ok) {
        invite = (await markSpecialInviteSent(invite.id)) ?? invite;
      }
    }

    return NextResponse.json({
      invite: {
        ...invite,
        eventTitle: event.title,
        inviteUrl,
      },
      mailSent,
      mailError,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create invite." },
      { status: 400 }
    );
  }
}
