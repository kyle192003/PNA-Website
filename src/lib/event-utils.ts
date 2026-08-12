import { conference } from "@/lib/conference";

const CARD_BLURB_MAX = 120;

export function splitEventTitleYear(title: string): { year: string | null; rest: string } {
  const match = title.trim().match(/^(\d{4})\s+(.+)$/);
  if (!match) return { year: null, rest: title };
  return { year: match[1], rest: match[2] };
}

export function getEventCardBlurb(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return "";

  const firstSentence =
    trimmed.match(/^[^.!?]+[.!?]/)?.[0]?.trim() ??
    trimmed.split(/\s+/).slice(0, 18).join(" ");

  if (firstSentence.length <= CARD_BLURB_MAX) {
    return firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;
  }

  return `${firstSentence.slice(0, CARD_BLURB_MAX - 1).trim()}…`;
}

type EventVenueFields = {
  venueName?: string | null;
  venueAddress?: string | null;
};

type EventDeadlineFields = {
  regularDeadline?: string | null;
  earlyBirdDeadline?: string | null;
};

/** Venue lines for public pages — prefers live event data over conference defaults. */
export function resolveEventVenueDisplay(event?: EventVenueFields | null): {
  name: string;
  address: string;
  city: string | null;
} {
  const usingEvent = Boolean(event?.venueName?.trim() || event?.venueAddress?.trim());
  return {
    name: event?.venueName?.trim() || conference.venue.name,
    address: event?.venueAddress?.trim() || conference.venue.address,
    city: usingEvent ? null : conference.venue.city,
  };
}

/** Registration deadline copy — prefers the featured event's regular deadline. */
export function resolveRegistrationDeadlineDisplay(event?: EventDeadlineFields | null): string {
  return (
    event?.regularDeadline?.trim() ||
    event?.earlyBirdDeadline?.trim() ||
    conference.registration.registrationClosesAt ||
    conference.registration.regularDeadline
  );
}

type VenueMapsFields = {
  venueName?: string | null;
  venueAddress?: string | null;
  venueMapsUrl?: string | null;
};

export function getVenueSearchQuery(venue: VenueMapsFields): string {
  return [venue.venueName?.trim(), venue.venueAddress?.trim()].filter(Boolean).join(", ");
}

/** Open Google Maps for a venue. Uses a custom URL when set, otherwise a search link. */
export function buildVenueMapsUrl(venue: VenueMapsFields): string | null {
  const custom = venue.venueMapsUrl?.trim();
  if (custom) return custom;

  const query = getVenueSearchQuery(venue);
  if (!query) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Embeddable Google Maps search view (no API key). */
export function buildVenueMapsEmbedUrl(venue: VenueMapsFields): string | null {
  const query = getVenueSearchQuery(venue);
  if (!query) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}
