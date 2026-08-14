import "server-only";

import { conference } from "@/lib/conference";
import { getEventById } from "@/lib/events";
import {
  sendPaymentConfirmedEmail,
  sendPaymentRejectedEmail,
  sendReceiptIssueEmail,
} from "@/lib/mail-templates";
import {
  getRegistrationById,
  getRegistrationsByGroupId,
  issueReceiptReuploadLink,
  updateRegistrationPaymentCascading,
} from "@/lib/registrations";
import type { PaymentStatus, RegistrationRecord } from "@/lib/types/admin";

const VALID_STATUSES: PaymentStatus[] = [
  "pending",
  "receipt_submitted",
  "paid",
  "receipt_issue",
  "rejected",
];

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as PaymentStatus);
}

export async function applyPaymentStatusChange(input: {
  registrationId: string;
  paymentStatus?: PaymentStatus;
  paymentNotes?: string;
  adminNotes?: string;
  resendReceiptEmail?: boolean;
  /** Accountant portal cannot reverse a paid registration. */
  irreversiblePaid?: boolean;
}): Promise<
  | { ok: true; registration: RegistrationRecord; updatedList: RegistrationRecord[] }
  | { ok: false; error: string; status: 400 | 404 }
> {
  const existing = await getRegistrationById(input.registrationId);
  if (!existing) {
    return { ok: false, error: "Participant not found.", status: 404 };
  }

  const paymentStatus = input.paymentStatus;
  const nextStatus = paymentStatus ?? existing.paymentStatus;
  const paymentNotes =
    typeof input.paymentNotes === "string" ? input.paymentNotes.trim() : existing.paymentNotes;

  if (input.irreversiblePaid && existing.paymentStatus === "paid") {
    return {
      ok: false,
      error: "This payment is already approved. Approved payments cannot be changed from this link.",
      status: 400,
    };
  }

  if ((nextStatus === "rejected" || nextStatus === "receipt_issue") && !paymentNotes) {
    return {
      ok: false,
      error: "A reason is required (e.g. blurry receipt, incomplete proof).",
      status: 400,
    };
  }

  const previousById = new Map<string, PaymentStatus>([[existing.id, existing.paymentStatus]]);
  if (existing.groupId) {
    const group = await getRegistrationsByGroupId(existing.groupId);
    for (const member of group) {
      previousById.set(member.id, member.paymentStatus);
    }
  }

  const updatedList = await updateRegistrationPaymentCascading(existing.id, {
    paymentStatus,
    adminNotes: input.adminNotes,
    paymentNotes,
  });

  const updated = updatedList.find((record) => record.id === existing.id) ?? updatedList[0];
  if (!updated) {
    return { ok: false, error: "Participant not found.", status: 404 };
  }

  const needsReuploadLink =
    (nextStatus === "rejected" && existing.paymentStatus !== "rejected") ||
    (nextStatus === "receipt_issue" && existing.paymentStatus !== "receipt_issue") ||
    Boolean(input.resendReceiptEmail && nextStatus === "receipt_issue");
  const mailRecords: RegistrationRecord[] = [];
  for (const record of updatedList) {
    if (needsReuploadLink) {
      mailRecords.push((await issueReceiptReuploadLink(record.id)) ?? record);
    } else {
      mailRecords.push(record);
    }
  }

  const event = updated.eventId ? await getEventById(updated.eventId) : null;
  const eventContext = event ?? {
    id: "unassigned",
    title: "PNA Conference Registration",
    datesDisplay: conference.dates.display,
    venueName: conference.venue.name,
    venueAddress: conference.venue.address,
    venueMapsUrl: null,
  };

  for (const record of mailRecords) {
    const previous = previousById.get(record.id) ?? record.paymentStatus;
    const becameRejected = nextStatus === "rejected" && previous !== "rejected";
    const becameReceiptIssue = nextStatus === "receipt_issue" && previous !== "receipt_issue";
    const resendReceiptIssueEmail =
      nextStatus === "receipt_issue" &&
      previous === "receipt_issue" &&
      input.resendReceiptEmail === true &&
      record.id === existing.id;
    const becamePaid = nextStatus === "paid" && previous !== "paid";

    if (becamePaid) {
      const mailResult = await sendPaymentConfirmedEmail(record, eventContext);
      if (!mailResult.ok) {
        console.error("[payment-status] payment confirmed email failed:", mailResult.error);
      }
    }

    if (becameRejected) {
      const mailResult = await sendPaymentRejectedEmail(record, eventContext, paymentNotes);
      if (!mailResult.ok) {
        console.error("[payment-status] rejection email failed:", mailResult.error);
      }
    }

    if (becameReceiptIssue || resendReceiptIssueEmail) {
      const mailResult = await sendReceiptIssueEmail(record, eventContext, paymentNotes);
      if (!mailResult.ok) {
        console.error("[payment-status] receipt issue email failed:", mailResult.error);
      }
    }
  }

  const withLink = mailRecords.find((record) => record.id === existing.id) ?? updated;
  return {
    ok: true,
    registration: withLink,
    updatedList: mailRecords,
  };
}
