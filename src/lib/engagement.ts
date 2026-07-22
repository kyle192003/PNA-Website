import { getEventEndDateIso, getEventStartDateIso, todayIsoInTimeZone } from "@/lib/event-date";
import { getAllEvents, getEventById, updateEvent } from "@/lib/events";
import {
  sendPostEventEvaluationInviteEmail,
  sendUpcomingEventPromotionEmail,
} from "@/lib/mail-templates";
import {
  getAllRegistrations,
  markEvaluationInviteSent,
  markPromotionSent,
} from "@/lib/registrations";
import type { ConferenceEvent, RegistrationRecord } from "@/lib/types/admin";

export type EngagementRunResult = {
  today: string;
  evaluationInvitesSent: number;
  promotionsSent: number;
  failed: number;
  details: Array<{
    registrationId: string;
    email: string;
    job: "evaluation_invite" | "promotion";
    status: "sent" | "skipped" | "failed";
    reason?: string;
  }>;
};

export type EvaluationInviteBatchResult = {
  eventId: string;
  eventTitle: string;
  invitesSent: number;
  skipped: number;
  failed: number;
  details: EngagementRunResult["details"];
};

function isEligibleForEvaluationInvite(registration: RegistrationRecord): boolean {
  return (
    registration.paymentStatus === "paid" &&
    registration.checkInStatus === "checked_in" &&
    !registration.evaluationInviteSentAt
  );
}

function shouldSendEvaluationInvite(event: ConferenceEvent, today: string): boolean {
  if (event.status === "finished") return true;
  const attendedEndIso = getEventEndDateIso(event);
  return Boolean(attendedEndIso && attendedEndIso < today);
}

/** Sends evaluation invites for one event (paid + checked-in, not yet invited). */
export async function sendEvaluationInvitesForEvent(
  eventId: string
): Promise<EvaluationInviteBatchResult> {
  const event = await getEventById(eventId);
  if (!event) {
    throw new Error("Event not found.");
  }

  const registrations = await getAllRegistrations();
  const result: EvaluationInviteBatchResult = {
    eventId: event.id,
    eventTitle: event.title,
    invitesSent: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const registration of registrations) {
    if (registration.eventId !== event.id) continue;

    if (!isEligibleForEvaluationInvite(registration)) {
      result.skipped += 1;
      result.details.push({
        registrationId: registration.id,
        email: registration.email,
        job: "evaluation_invite",
        status: "skipped",
        reason: "Not paid, not checked in, or invite already sent.",
      });
      continue;
    }

    const mail = await sendPostEventEvaluationInviteEmail(registration, event);
    if (mail.ok) {
      await markEvaluationInviteSent(registration.id);
      result.invitesSent += 1;
      result.details.push({
        registrationId: registration.id,
        email: registration.email,
        job: "evaluation_invite",
        status: "sent",
      });
    } else {
      result.failed += 1;
      result.details.push({
        registrationId: registration.id,
        email: registration.email,
        job: "evaluation_invite",
        status: "failed",
        reason: mail.error,
      });
    }
  }

  return result;
}

/** Marks event finished and immediately sends evaluation invites. */
export async function finishEventAndSendEvaluations(eventId: string): Promise<{
  event: ConferenceEvent;
  invites: EvaluationInviteBatchResult;
}> {
  const updated = await updateEvent(eventId, {
    status: "finished",
    featuredOnHomepage: false,
  });
  if (!updated) {
    throw new Error("Event not found.");
  }

  const invites = await sendEvaluationInvitesForEvent(eventId);
  return { event: updated, invites };
}

export async function runParticipantEngagementJob(): Promise<EngagementRunResult> {
  const today = todayIsoInTimeZone();
  const [events, registrations] = await Promise.all([getAllEvents(), getAllRegistrations()]);
  const eventById = new Map(events.map((event) => [event.id, event]));

  const upcomingEvents = events
    .filter((event) => {
      const start = getEventStartDateIso(event);
      return Boolean(start && start >= today && (event.status === "upcoming" || event.status === "open"));
    })
    .sort((a, b) => {
      const aStart = getEventStartDateIso(a) ?? "9999-12-31";
      const bStart = getEventStartDateIso(b) ?? "9999-12-31";
      return aStart.localeCompare(bStart);
    });

  const result: EngagementRunResult = {
    today,
    evaluationInvitesSent: 0,
    promotionsSent: 0,
    failed: 0,
    details: [],
  };

  for (const registration of registrations) {
    if (registration.paymentStatus !== "paid" || registration.checkInStatus !== "checked_in") {
      continue;
    }
    if (!registration.eventId) continue;

    const attendedEvent = eventById.get(registration.eventId);
    if (!attendedEvent) continue;

    if (!shouldSendEvaluationInvite(attendedEvent, today)) continue;

    if (!registration.evaluationInviteSentAt) {
      const mail = await sendPostEventEvaluationInviteEmail(registration, attendedEvent);
      if (mail.ok) {
        await markEvaluationInviteSent(registration.id);
        result.evaluationInvitesSent += 1;
        result.details.push({
          registrationId: registration.id,
          email: registration.email,
          job: "evaluation_invite",
          status: "sent",
        });
      } else {
        result.failed += 1;
        result.details.push({
          registrationId: registration.id,
          email: registration.email,
          job: "evaluation_invite",
          status: "failed",
          reason: mail.error,
        });
      }
    }

    for (const upcomingEvent of upcomingEvents) {
      if (upcomingEvent.id === attendedEvent.id) continue;
      if (registration.promotionSentEventIds.includes(upcomingEvent.id)) continue;

      const mail = await sendUpcomingEventPromotionEmail(registration, upcomingEvent);
      if (!mail.ok) {
        result.failed += 1;
        result.details.push({
          registrationId: registration.id,
          email: registration.email,
          job: "promotion",
          status: "failed",
          reason: mail.error,
        });
        continue;
      }

      await markPromotionSent(registration.id, upcomingEvent.id);
      result.promotionsSent += 1;
      result.details.push({
        registrationId: registration.id,
        email: registration.email,
        job: "promotion",
        status: "sent",
      });
    }
  }

  return result;
}
