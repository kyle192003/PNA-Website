import {
  formatLongDate,
  getEventStartDateIso,
  todayIsoInTimeZone,
} from "@/lib/event-date";
import { getEventById } from "@/lib/events";
import { formatParticipantName } from "@/lib/participant-name";
import {
  getRegistrationByCheckInToken,
  markRegistrationCheckedIn,
} from "@/lib/registrations";

export type CheckInOutcome =
  | {
      result: "checked_in";
      message: string;
      participantName: string;
      eventTitle: string;
      checkedInAt: string;
    }
  | {
      result: "already_checked_in";
      message: string;
      participantName: string;
      eventTitle: string;
      checkedInAt: string | null;
    }
  | {
      result: "too_early";
      message: string;
      participantName: string;
      eventTitle: string;
      eventDateLabel: string;
    }
  | {
      result: "not_eligible";
      message: string;
      participantName: string;
      eventTitle: string;
    }
  | {
      result: "invalid";
      message: string;
    };

export async function processCheckInScan(
  token: string,
  scannedBy: string | null
): Promise<CheckInOutcome> {
  const registration = await getRegistrationByCheckInToken(token);

  if (!registration) {
    return {
      result: "invalid",
      message: "This QR code is invalid or was not found.",
    };
  }

  const event = registration.eventId ? await getEventById(registration.eventId) : null;
  const eventTitle = event?.title ?? "Event";
  const participantName = formatParticipantName(registration);

  if (registration.checkInStatus === "checked_in") {
    return {
      result: "already_checked_in",
      message: "This participant is already inside the venue / already confirmed.",
      participantName,
      eventTitle,
      checkedInAt: registration.checkedInAt,
    };
  }

  if (registration.paymentStatus !== "paid") {
    return {
      result: "not_eligible",
      message:
        "Payment is not yet confirmed for this participant. Check-in is only available for paid registrations.",
      participantName,
      eventTitle,
    };
  }

  if (event) {
    const startIso = getEventStartDateIso(event);
    if (startIso) {
      const today = todayIsoInTimeZone();
      if (today < startIso) {
        const eventDateLabel = formatLongDate(startIso);
        return {
          result: "too_early",
          message: `The event date is ${eventDateLabel}. Please wait and present this QR to the front desk on the event day.`,
          participantName,
          eventTitle,
          eventDateLabel,
        };
      }
    }
  }

  const updated = await markRegistrationCheckedIn(registration.id, scannedBy);
  if (!updated) {
    return {
      result: "invalid",
      message: "This QR code is invalid or was not found.",
    };
  }

  return {
    result: "checked_in",
    message: `Welcome, ${participantName}. Check-in successful.`,
    participantName,
    eventTitle,
    checkedInAt: updated.checkedInAt ?? new Date().toISOString(),
  };
}
