import { NextResponse } from "next/server";
import type { PaymentStatus } from "@/lib/types/admin";
import { conference } from "@/lib/conference";
import { getEventById } from "@/lib/events";
import {
  sendPaymentConfirmedEmail,
  sendPaymentRejectedEmail,
  sendReceiptIssueEmail,
} from "@/lib/mail-templates";
import { getRegistrationById, updateRegistrationPayment, deleteRegistration } from "@/lib/registrations";

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
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await getRegistrationById(id);
    if (!existing) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    if (body.paymentStatus && !validStatuses.includes(body.paymentStatus)) {
      return NextResponse.json({ error: "Invalid payment status." }, { status: 400 });
    }

    const nextStatus = (body.paymentStatus as PaymentStatus | undefined) ?? existing.paymentStatus;
    const paymentNotes =
      typeof body.paymentNotes === "string" ? body.paymentNotes.trim() : existing.paymentNotes;

    if ((nextStatus === "rejected" || nextStatus === "receipt_issue") && !paymentNotes) {
      return NextResponse.json(
        {
          error:
            "A message for the participant is required (e.g. blurry receipt, incomplete proof).",
        },
        { status: 400 }
      );
    }

    const updated = await updateRegistrationPayment(id, {
      paymentStatus: body.paymentStatus,
      adminNotes: body.adminNotes?.trim(),
      paymentNotes,
    });

    if (!updated) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    const becameRejected =
      nextStatus === "rejected" && existing.paymentStatus !== "rejected";
    const becameReceiptIssue =
      nextStatus === "receipt_issue" && existing.paymentStatus !== "receipt_issue";
    const becamePaid = nextStatus === "paid" && existing.paymentStatus !== "paid";

    if (becameRejected || becameReceiptIssue || becamePaid) {
      const event = updated.eventId
        ? await getEventById(updated.eventId)
        : null;
      const eventContext = event ?? {
        id: "unassigned",
        title: "PNA Conference Registration",
        datesDisplay: conference.dates.display,
        venueName: conference.venue.name,
        venueAddress: conference.venue.address,
        venueMapsUrl: null,
      };

      if (becamePaid) {
        const mailResult = await sendPaymentConfirmedEmail(updated, eventContext);
        if (!mailResult.ok) {
          console.error("[participants] payment confirmed email failed:", mailResult.error);
        }
      }

      if (becameRejected) {
        const mailResult = await sendPaymentRejectedEmail(updated, eventContext, paymentNotes);
        if (!mailResult.ok) {
          console.error("[participants] rejection email failed:", mailResult.error);
        }
      }

      if (becameReceiptIssue) {
        const mailResult = await sendReceiptIssueEmail(updated, eventContext, paymentNotes);
        if (!mailResult.ok) {
          console.error("[participants] receipt issue email failed:", mailResult.error);
        }
      }
    }

    return NextResponse.json({ registration: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update participant.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
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
