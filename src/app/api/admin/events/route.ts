import { NextResponse } from "next/server";
import {
  createEvent,
  getAllEvents,
  getFeaturedHomepageEvent,
  parseEventMutationInput,
} from "@/lib/events";
import { conference } from "@/lib/conference";
import { parseEventStartDate, todayIsoInTimeZone } from "@/lib/event-date";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readJsonBody } from "@/lib/security/safe-input";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const [events, featuredHomepageEvent] = await Promise.all([
    getAllEvents(),
    getFeaturedHomepageEvent(),
  ]);

  return NextResponse.json({
    events,
    featuredHomepageEvent: featuredHomepageEvent
      ? { id: featuredHomepageEvent.id, title: featuredHomepageEvent.title }
      : null,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const input = parseEventMutationInput(parsed.data);
    const fees = input.fees ?? conference.registration.fees;

    if (!input.title?.trim() || !input.datesDisplay?.trim()) {
      return NextResponse.json(
        { error: "Title and dates are required." },
        { status: 400 }
      );
    }

    const startIso = parseEventStartDate(String(input.datesDisplay));
    if (!startIso) {
      return NextResponse.json(
        { error: "Please provide a valid event start date." },
        { status: 400 }
      );
    }

    const todayIso = todayIsoInTimeZone();
    if (startIso < todayIso) {
      return NextResponse.json(
        { error: "Event start date cannot be in the past." },
        { status: 400 }
      );
    }

    const event = await createEvent({
      title: input.title,
      theme: input.theme ?? conference.theme,
      description: input.description ?? conference.hero.description,
      datesDisplay: input.datesDisplay,
      venueName: input.venueName ?? conference.venue.name,
      venueAddress: input.venueAddress ?? conference.venue.address,
      venueMapsUrl: input.venueMapsUrl?.trim() || null,
      earlyBirdDeadline:
        input.earlyBirdDeadline ?? conference.registration.earlyBirdDeadline,
      regularDeadline: input.regularDeadline ?? conference.registration.regularDeadline,
      fees,
      showQrInRegistration: Boolean(input.showQrInRegistration),
      status: input.status,
      featuredOnHomepage: Boolean(input.featuredOnHomepage),
      isActive: Boolean(input.isActive),
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
