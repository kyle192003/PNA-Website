import { NextResponse } from "next/server";
import type { PaymentStatus } from "@/lib/types/admin";
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
  updateRegistrationPaymentCascading,
  deleteRegistration,
} from "@/lib/registrations";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readJsonBody } from "@/lib/security/safe-input";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const validStatuses: PaymentStatus[] = [
  "pending",
  "receipt_submitted",
  "paid",
  "receipt_issue",
  "rejected",
];

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;

    const existing = await getRegistrationById(id);
    if (!existing) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    const paymentStatus =
      typeof body.paymentStatus === "string" &&
      validStatuses.includes(body.paymentStatus as PaymentStatus)
        ? (body.paymentStatus as PaymentStatus)
        : undefined;

    if (body.paymentStatus !== undefined && paymentStatus === undefined) {
      return NextResponse.json({ error: "Invalid payment status." }, { status: 400 });
    }

    const nextStatus = paymentStatus ?? existing.paymentStatus;
    const paymentNotes =
      typeof body.paymentNotes === "string" ? body.paymentNotes.trim() : existing.paymentNotes;
    const adminNotes =
      typeof body.adminNotes === "string" ? body.adminNotes.trim() : undefined;

    if ((nextStatus === "rejected" || nextStatus === "receipt_issue") && !paymentNotes) {
      return NextResponse.json(
        {
          error:
            "A message for the participant is required (e.g. blurry receipt, incomplete proof).",
        },
        { status: 400 }
      );
    }

    // Capture previous statuses for cascade email decisions.
    const previousById = new Map<string, PaymentStatus>([[existing.id, existing.paymentStatus]]);
    if (existing.groupId) {
      const group = await getRegistrationsByGroupId(existing.groupId);
      for (const member of group) {
        previousById.set(member.id, member.paymentStatus);
      }
    }

    const updatedList = await updateRegistrationPaymentCascading(id, {
      paymentStatus,
      adminNotes,
      paymentNotes,
    });

    const updated = updatedList.find((r) => r.id === id) ?? updatedList[0];
    if (!updated) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
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

    for (const record of updatedList) {
      const previous = previousById.get(record.id) ?? record.paymentStatus;
      const becameRejected = nextStatus === "rejected" && previous !== "rejected";
      const becameReceiptIssue = nextStatus === "receipt_issue" && previous !== "receipt_issue";
      const resendReceiptIssueEmail =
        nextStatus === "receipt_issue" &&
        previous === "receipt_issue" &&
        body.resendReceiptEmail === true &&
        record.id === id;
      const becamePaid = nextStatus === "paid" && previous !== "paid";

      if (becamePaid) {
        const mailResult = await sendPaymentConfirmedEmail(record, eventContext);
        if (!mailResult.ok) {
          console.error("[participants] payment confirmed email failed:", mailResult.error);
        }
      }

      if (becameRejected) {
        const mailResult = await sendPaymentRejectedEmail(record, eventContext, paymentNotes);
        if (!mailResult.ok) {
          console.error("[participants] rejection email failed:", mailResult.error);
        }
      }

      if (becameReceiptIssue || resendReceiptIssueEmail) {
        const mailResult = await sendReceiptIssueEmail(record, eventContext, paymentNotes);
        if (!mailResult.ok) {
          console.error("[participants] receipt issue email failed:", mailResult.error);
        }
      }
    }

    return NextResponse.json({
      registration: updated,
      groupUpdated: updatedList.length > 1 ? updatedList.length : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update participant.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const existing = await getRegistrationById(id);
    if (!existing) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    const deleted = await deleteRegistration(id);
    if (!deleted) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    return NextResponse.json({
      message: "Participant removed.",
      id: existing.id,
      referenceNumber: existing.referenceNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete participant.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
