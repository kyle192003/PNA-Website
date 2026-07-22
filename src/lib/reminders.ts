import {
  daysUntilEvent,
  getEventStartDateIso,
  reminderWindowForDaysUntil,
  todayIsoInTimeZone,
  type ReminderWindow,
} from "@/lib/event-date";
import { getAllEvents } from "@/lib/events";
import { sendEventReminderEmail } from "@/lib/mail-templates";
import {
  getAllRegistrations,
  markReminderSent,
} from "@/lib/registrations";
import type { RegistrationRecord } from "@/lib/types/admin";

export type ReminderRunResult = {
  today: string;
  examined: number;
  sent: number;
  skipped: number;
  failed: number;
  details: Array<{
    registrationId: string;
    email: string;
    window: ReminderWindow;
    status: "sent" | "skipped" | "failed";
    reason?: string;
  }>;
};

function alreadySent(registration: RegistrationRecord, window: ReminderWindow): boolean {
  if (window === "3d") return Boolean(registration.reminder3dSentAt);
  if (window === "2d") return Boolean(registration.reminder2dSentAt);
  return Boolean(registration.reminder0dSentAt);
}

/**
 * Sends due reminder emails for paid participants (idempotent per window).
 */
export async function runEventReminderJob(): Promise<ReminderRunResult> {
  const today = todayIsoInTimeZone();
  const events = await getAllEvents();
  const eventById = new Map(events.map((event) => [event.id, event]));
  const registrations = await getAllRegistrations();

  const result: ReminderRunResult = {
    today,
    examined: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const registration of registrations) {
    if (registration.paymentStatus !== "paid") continue;
    if (!registration.eventId) continue;
    if (!registration.checkInToken) continue;

    const event = eventById.get(registration.eventId);
    if (!event) continue;

    const startIso = getEventStartDateIso(event);
    if (!startIso) {
      result.skipped += 1;
      result.details.push({
        registrationId: registration.id,
        email: registration.email,
        window: "0d",
        status: "skipped",
        reason: `Could not parse event datesDisplay: ${event.datesDisplay}`,
      });
      continue;
    }

    const days = daysUntilEvent(startIso, today);
    const window = reminderWindowForDaysUntil(days);
    if (!window) continue;

    result.examined += 1;

    if (alreadySent(registration, window)) {
      result.skipped += 1;
      result.details.push({
        registrationId: registration.id,
        email: registration.email,
        window,
        status: "skipped",
        reason: "Already sent for this window",
      });
      continue;
    }

    const mailResult = await sendEventReminderEmail(
      registration,
      event,
      window,
      startIso
    );

    if (!mailResult.ok) {
      result.failed += 1;
      result.details.push({
        registrationId: registration.id,
        email: registration.email,
        window,
        status: "failed",
        reason: mailResult.error,
      });
      continue;
    }

    await markReminderSent(registration.id, window);
    result.sent += 1;
    result.details.push({
      registrationId: registration.id,
      email: registration.email,
      window,
      status: "sent",
    });
  }

  return result;
}
