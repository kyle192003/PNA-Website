import { NextResponse } from "next/server";
import { applyPaymentStatusChange, isPaymentStatus } from "@/lib/payment-status-actions";
import { deleteRegistration, getRegistrationById } from "@/lib/registrations";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readJsonBody, stringField, booleanField } from "@/lib/security/safe-input";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

    if (body.paymentStatus !== undefined && !isPaymentStatus(body.paymentStatus)) {
      return NextResponse.json({ error: "Invalid payment status." }, { status: 400 });
    }

    const result = await applyPaymentStatusChange({
      registrationId: id,
      paymentStatus: isPaymentStatus(body.paymentStatus) ? body.paymentStatus : undefined,
      paymentNotes: stringField(body.paymentNotes),
      adminNotes: stringField(body.adminNotes),
      resendReceiptEmail: booleanField(body.resendReceiptEmail) === true,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      registration: result.registration,
      groupUpdated: result.updatedList.length > 1 ? result.updatedList.length : undefined,
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
