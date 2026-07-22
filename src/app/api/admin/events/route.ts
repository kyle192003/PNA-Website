import { NextResponse } from "next/server";
import { createEvent, getAllEvents, getFeaturedHomepageEvent } from "@/lib/events";
import { conference } from "@/lib/conference";

export async function GET() {
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
  try {
    const body = await request.json();
    const fees = body.fees ?? conference.registration.fees;

    if (!body.title?.trim() || !body.datesDisplay?.trim()) {
      return NextResponse.json(
        { error: "Title and dates are required." },
        { status: 400 }
      );
    }

    const event = await createEvent({
      title: body.title,
      theme: body.theme ?? conference.theme,
      description: body.description ?? conference.hero.description,
      datesDisplay: body.datesDisplay,
      venueName: body.venueName ?? conference.venue.name,
      venueAddress: body.venueAddress ?? conference.venue.address,
      venueMapsUrl: body.venueMapsUrl?.trim() || null,
      earlyBirdDeadline:
        body.earlyBirdDeadline ?? conference.registration.earlyBirdDeadline,
      regularDeadline:
        body.regularDeadline ?? conference.registration.regularDeadline,
      fees,
      showQrInRegistration: Boolean(body.showQrInRegistration),
      status: body.status,
      featuredOnHomepage: Boolean(body.featuredOnHomepage),
      isActive: Boolean(body.isActive),
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
