import { v4 as uuidv4 } from "uuid";
import { findByField } from "@/lib/json-query";
import { conference } from "@/lib/conference";
import { generateAndSaveRegistrationQr } from "@/lib/registration-qr";
import { readJsonDocument, writeJsonDocument } from "@/lib/json-store";
import { normalizeEventFees } from "@/lib/registration-fees";
import type {
  ConferenceEvent,
  EventFees,
  EventInput,
  EventSpeaker,
  EventSpeakerInput,
  EventStatus,
  PublicEvent,
} from "@/lib/types/admin";
import { getDefaultEventFees } from "@/lib/types/admin";

const EVENTS_FILENAME = "events.json";

const defaultFees = getDefaultEventFees();

function resolveStatus(
  event: Partial<ConferenceEvent> & { isActive?: boolean; status?: EventStatus }
): EventStatus {
  if (
    event.status === "draft" ||
    event.status === "upcoming" ||
    event.status === "open" ||
    event.status === "finished"
  ) {
    return event.status;
  }
  return event.isActive ? "open" : "draft";
}

function normalizeSpeaker(speaker: Partial<EventSpeaker>): EventSpeaker {
  return {
    id: speaker.id ?? uuidv4(),
    name: speaker.name?.trim() ?? "",
    title: speaker.title?.trim() ?? "",
    organization: speaker.organization?.trim() ?? "",
    imageUrl: speaker.imageUrl ?? null,
  };
}

function normalizeSpeakers(speakers?: EventSpeaker[]): EventSpeaker[] {
  return (speakers ?? []).map((speaker) => normalizeSpeaker(speaker));
}

function normalizeEvent(
  event: ConferenceEvent & { highlightQrOnHomepage?: boolean; featuredOnHomepage?: boolean }
): ConferenceEvent {
  const status = resolveStatus(event);
  const wantsFeatured = event.featuredOnHomepage ?? false;

  return {
    ...event,
    status,
    isActive: status === "open",
    featuredOnHomepage:
      wantsFeatured && (status === "open" || status === "upcoming"),
    showQrInRegistration:
      event.showQrInRegistration ?? event.highlightQrOnHomepage ?? false,
    registrationQrCodeUrl: event.registrationQrCodeUrl ?? null,
    venueMapsUrl: event.venueMapsUrl?.trim() || null,
    fees: normalizeEventFees(event.fees),
    speakers: normalizeSpeakers(event.speakers),
  };
}

function toPublicEvent(event: ConferenceEvent): PublicEvent | null {
  if (event.status !== "upcoming" && event.status !== "open") {
    return null;
  }

  return {
    id: event.id,
    title: event.title,
    theme: event.theme,
    description: event.description,
    datesDisplay: event.datesDisplay,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    venueMapsUrl: event.venueMapsUrl ?? null,
    earlyBirdDeadline: event.earlyBirdDeadline,
    regularDeadline: event.regularDeadline,
    status: event.status,
    fees: event.fees,
    featuredOnHomepage: event.featuredOnHomepage,
    speakers: event.speakers,
  };
}

function sortPublicEvents(a: PublicEvent, b: PublicEvent): number {
  if (a.featuredOnHomepage !== b.featuredOnHomepage) {
    return a.featuredOnHomepage ? -1 : 1;
  }
  if (a.status !== b.status) {
    return a.status === "open" ? -1 : 1;
  }
  return 0;
}

async function readEvents(): Promise<ConferenceEvent[]> {
  const parsed = await readJsonDocument<
    Array<ConferenceEvent & { highlightQrOnHomepage?: boolean }>
  >(EVENTS_FILENAME, []);
  const events = parsed.map(normalizeEvent);

  if (enforceSingleFeaturedEvent(events)) {
    await writeEvents(events);
  }

  return events;
}

async function writeEvents(events: ConferenceEvent[]): Promise<void> {
  enforceSingleFeaturedEvent(events);
  await writeJsonDocument(EVENTS_FILENAME, events);
}

function normalizeInputStatus(input: Partial<EventInput>): EventStatus {
  if (
    input.status === "draft" ||
    input.status === "upcoming" ||
    input.status === "open" ||
    input.status === "finished"
  ) {
    return input.status;
  }
  if (input.isActive) return "open";
  return "draft";
}

function clearOtherFeaturedEvents(events: ConferenceEvent[], keepId?: string): void {
  events.forEach((event) => {
    if (event.id !== keepId) {
      event.featuredOnHomepage = false;
    }
  });
}

function enforceSingleFeaturedEvent(events: ConferenceEvent[]): boolean {
  const featuredEvents = events.filter((event) => event.featuredOnHomepage);
  if (featuredEvents.length <= 1) {
    return false;
  }

  const keep = featuredEvents.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];

  clearOtherFeaturedEvents(events, keep.id);
  return true;
}

export async function getFeaturedHomepageEvent(): Promise<ConferenceEvent | null> {
  const events = await readEvents();
  return events.find((event) => event.featuredOnHomepage) ?? null;
}

export async function getAllEvents(): Promise<ConferenceEvent[]> {
  const events = await readEvents();
  return events.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getPublicEvents(): Promise<PublicEvent[]> {
  const events = await readEvents();
  return events
    .map(toPublicEvent)
    .filter((event): event is PublicEvent => event !== null)
    .sort(sortPublicEvents);
}

export async function getHomepageEvents(): Promise<{
  featured: PublicEvent | null;
  others: PublicEvent[];
}> {
  const publicEvents = await getPublicEvents();
  if (publicEvents.length === 0) {
    return { featured: null, others: [] };
  }

  const featured =
    publicEvents.find((event) => event.featuredOnHomepage) ??
    publicEvents.find((event) => event.status === "open") ??
    publicEvents[0];

  const others = publicEvents.filter(
    (event) => event.id !== featured.id && !event.featuredOnHomepage
  );

  return { featured, others };
}

export async function getEventById(id: string): Promise<ConferenceEvent | null> {
  const events = await readEvents();
  return findByField(events, "id", id) ?? null;
}

export async function getPublicEventById(id: string): Promise<PublicEvent | null> {
  const event = await getEventById(id);
  if (!event) return null;
  return toPublicEvent(event);
}

export async function getActiveEvent(): Promise<ConferenceEvent | null> {
  const events = await readEvents();
  return (
    events.find((event) => event.status === "open" && event.featuredOnHomepage) ??
    events.find((event) => event.status === "open") ??
    null
  );
}

export async function getOpenEventById(id: string): Promise<ConferenceEvent | null> {
  const event = await getEventById(id);
  if (!event || event.status !== "open") return null;
  return event;
}

export async function getRegistrationSidebarEvent(
  eventId?: string | null
): Promise<ConferenceEvent | null> {
  if (eventId) {
    const event = await getEventById(eventId);
    if (!event || event.status !== "open") return null;
    return event;
  }

  const events = await readEvents();
  return events.find((event) => event.status === "open") ?? null;
}

export async function getRegistrationQrEvent(
  eventId?: string | null
): Promise<ConferenceEvent | null> {
  const event = await getRegistrationSidebarEvent(eventId);
  if (!event?.qrCodeUrl || !event.showQrInRegistration) return null;
  return event;
}

function normalizeFees(fees: EventInput["fees"] | unknown): EventFees {
  return normalizeEventFees(fees ?? defaultFees);
}

export async function createEvent(input: EventInput): Promise<ConferenceEvent> {
  const events = await readEvents();
  const now = new Date().toISOString();
  const status = normalizeInputStatus(input);
  const canFeature = status === "open" || status === "upcoming";
  const featuredOnHomepage = canFeature && Boolean(input.featuredOnHomepage);

  if (featuredOnHomepage) {
    clearOtherFeaturedEvents(events);
  }

  const event: ConferenceEvent = {
    id: uuidv4(),
    title: input.title.trim(),
    theme: input.theme.trim(),
    description: input.description.trim(),
    datesDisplay: input.datesDisplay.trim(),
    venueName: input.venueName.trim(),
    venueAddress: input.venueAddress.trim(),
    venueMapsUrl: input.venueMapsUrl?.trim() || null,
    earlyBirdDeadline: input.earlyBirdDeadline.trim(),
    regularDeadline: input.regularDeadline.trim(),
    fees: normalizeFees(input.fees),
    qrCodeUrl: null,
    registrationQrCodeUrl: null,
    showQrInRegistration: input.showQrInRegistration ?? false,
    status,
    featuredOnHomepage,
    isActive: status === "open",
    speakers: [],
    createdAt: now,
    updatedAt: now,
  };

  events.push(event);
  await writeEvents(events);

  try {
    const registrationQrCodeUrl = await generateAndSaveRegistrationQr(event.id, {
      caption: event.title,
    });
    return (await updateEvent(event.id, { registrationQrCodeUrl })) ?? event;
  } catch {
    return event;
  }
}

/** Bind only known event fields so request JSON cannot invent columns. */
export function parseEventMutationInput(body: Record<string, unknown>): Partial<EventInput> & {
  qrCodeUrl?: string | null;
  registrationQrCodeUrl?: string | null;
} {
  const input: Partial<EventInput> & {
    qrCodeUrl?: string | null;
    registrationQrCodeUrl?: string | null;
  } = {};

  if (typeof body.title === "string") input.title = body.title;
  if (typeof body.theme === "string") input.theme = body.theme;
  if (typeof body.description === "string") input.description = body.description;
  if (typeof body.datesDisplay === "string") input.datesDisplay = body.datesDisplay;
  if (typeof body.venueName === "string") input.venueName = body.venueName;
  if (typeof body.venueAddress === "string") input.venueAddress = body.venueAddress;
  if (body.venueMapsUrl === null) input.venueMapsUrl = null;
  else if (typeof body.venueMapsUrl === "string") input.venueMapsUrl = body.venueMapsUrl;
  if (typeof body.earlyBirdDeadline === "string") input.earlyBirdDeadline = body.earlyBirdDeadline;
  if (typeof body.regularDeadline === "string") input.regularDeadline = body.regularDeadline;
  if (body.fees && typeof body.fees === "object") input.fees = body.fees as EventFees;
  if (typeof body.showQrInRegistration === "boolean") {
    input.showQrInRegistration = body.showQrInRegistration;
  }
  if (typeof body.featuredOnHomepage === "boolean") {
    input.featuredOnHomepage = body.featuredOnHomepage;
  }
  if (typeof body.isActive === "boolean") input.isActive = body.isActive;
  if (
    body.status === "draft" ||
    body.status === "upcoming" ||
    body.status === "open" ||
    body.status === "finished"
  ) {
    input.status = body.status;
  }
  if (typeof body.qrCodeUrl === "string" || body.qrCodeUrl === null) {
    input.qrCodeUrl = body.qrCodeUrl;
  }
  if (typeof body.registrationQrCodeUrl === "string" || body.registrationQrCodeUrl === null) {
    input.registrationQrCodeUrl = body.registrationQrCodeUrl;
  }

  return input;
}

export async function updateEvent(
  id: string,
  input: Partial<EventInput> & {
    qrCodeUrl?: string | null;
    registrationQrCodeUrl?: string | null;
  }
): Promise<ConferenceEvent | null> {
  const events = await readEvents();
  const index = events.findIndex((event) => event.id === id);
  if (index === -1) return null;

  const current = events[index];
  const nextStatus =
    input.status !== undefined || input.isActive !== undefined
      ? normalizeInputStatus({ ...current, ...input })
      : current.status;

  const canFeature = nextStatus === "open" || nextStatus === "upcoming";
  const requestedFeatured =
    input.featuredOnHomepage !== undefined
      ? input.featuredOnHomepage
      : current.featuredOnHomepage;
  const nextFeatured = canFeature && requestedFeatured;

  if (nextFeatured) {
    clearOtherFeaturedEvents(events, id);
  }

  const updated: ConferenceEvent = {
    ...current,
    title: input.title?.trim() ?? current.title,
    theme: input.theme?.trim() ?? current.theme,
    description: input.description?.trim() ?? current.description,
    datesDisplay: input.datesDisplay?.trim() ?? current.datesDisplay,
    venueName: input.venueName?.trim() ?? current.venueName,
    venueAddress: input.venueAddress?.trim() ?? current.venueAddress,
    venueMapsUrl:
      input.venueMapsUrl !== undefined
        ? input.venueMapsUrl?.trim() || null
        : current.venueMapsUrl ?? null,
    earlyBirdDeadline: input.earlyBirdDeadline?.trim() ?? current.earlyBirdDeadline,
    regularDeadline: input.regularDeadline?.trim() ?? current.regularDeadline,
    fees: input.fees ? normalizeFees(input.fees) : current.fees,
    qrCodeUrl: input.qrCodeUrl !== undefined ? input.qrCodeUrl : current.qrCodeUrl,
    registrationQrCodeUrl:
      input.registrationQrCodeUrl !== undefined
        ? input.registrationQrCodeUrl
        : current.registrationQrCodeUrl,
    showQrInRegistration: input.showQrInRegistration ?? current.showQrInRegistration,
    status: nextStatus,
    featuredOnHomepage: nextFeatured,
    isActive: nextStatus === "open",
    speakers: input.speakers ? normalizeSpeakers(input.speakers) : current.speakers,
    updatedAt: new Date().toISOString(),
  };

  events[index] = updated;
  await writeEvents(events);
  return updated;
}

export async function setEventQrCode(
  id: string,
  qrCodeUrl: string
): Promise<ConferenceEvent | null> {
  return updateEvent(id, { qrCodeUrl });
}

export async function deleteEvent(id: string): Promise<boolean> {
  const events = await readEvents();
  const filtered = events.filter((event) => event.id !== id);
  if (filtered.length === events.length) return false;
  await writeEvents(filtered);
  return true;
}

export async function addEventSpeaker(
  eventId: string,
  input: EventSpeakerInput
): Promise<ConferenceEvent | null> {
  const events = await readEvents();
  const index = events.findIndex((event) => event.id === eventId);
  if (index === -1) return null;

  if (!input.name.trim()) {
    throw new Error("Speaker name is required.");
  }

  const speaker = normalizeSpeaker(input);
  const updated: ConferenceEvent = {
    ...events[index],
    speakers: [...events[index].speakers, speaker],
    updatedAt: new Date().toISOString(),
  };

  events[index] = updated;
  await writeEvents(events);
  return updated;
}

export async function updateEventSpeaker(
  eventId: string,
  speakerId: string,
  input: Partial<EventSpeakerInput>
): Promise<ConferenceEvent | null> {
  const events = await readEvents();
  const index = events.findIndex((event) => event.id === eventId);
  if (index === -1) return null;

  const speakerIndex = events[index].speakers.findIndex((speaker) => speaker.id === speakerId);
  if (speakerIndex === -1) return null;

  const current = events[index].speakers[speakerIndex];
  const nextName = input.name?.trim() ?? current.name;
  if (!nextName) {
    throw new Error("Speaker name is required.");
  }

  const updatedSpeaker = normalizeSpeaker({
    ...current,
    ...input,
    id: speakerId,
    name: nextName,
  });

  const speakers = [...events[index].speakers];
  speakers[speakerIndex] = updatedSpeaker;

  const updated: ConferenceEvent = {
    ...events[index],
    speakers,
    updatedAt: new Date().toISOString(),
  };

  events[index] = updated;
  await writeEvents(events);
  return updated;
}

export async function deleteEventSpeaker(
  eventId: string,
  speakerId: string
): Promise<ConferenceEvent | null> {
  const events = await readEvents();
  const index = events.findIndex((event) => event.id === eventId);
  if (index === -1) return null;

  const removed = events[index].speakers.find((speaker) => speaker.id === speakerId);
  if (!removed) return null;

  const { deleteUploadedFile } = await import("@/lib/uploads");
  await deleteUploadedFile(removed.imageUrl);

  const speakers = events[index].speakers.filter((speaker) => speaker.id !== speakerId);

  const updated: ConferenceEvent = {
    ...events[index],
    speakers,
    updatedAt: new Date().toISOString(),
  };

  events[index] = updated;
  await writeEvents(events);
  return updated;
}
