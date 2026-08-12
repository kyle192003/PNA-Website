import { NextResponse } from "next/server";
import { finishEventAndSendEvaluations } from "@/lib/engagement";
import { deleteEvent, getEventById, parseEventMutationInput, updateEvent } from "@/lib/events";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readJsonBody } from "@/lib/security/safe-input";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const event = await getEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  return NextResponse.json({ event });
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
    const input = parseEventMutationInput(parsed.data);
    const previous = await getEventById(id);

    // Saving status as Finished should also send evaluation invites immediately.
    if (input.status === "finished" && previous?.status !== "finished") {
      const result = await finishEventAndSendEvaluations(id);
      const rest = { ...input };
      delete rest.status;
      const hasOtherFields = Object.keys(rest).length > 0;
      const event = hasOtherFields
        ? (await updateEvent(id, rest)) ?? result.event
        : result.event;

      return NextResponse.json({
        event,
        evaluationInvites: result.invites,
        message:
          result.invites.invitesSent > 0
            ? `Event marked finished. Sent ${result.invites.invitesSent} evaluation invite${result.invites.invitesSent === 1 ? "" : "s"}.`
            : "Event marked finished. No new evaluation invites were needed.",
      });
    }

    const event = await updateEvent(id, input);

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const deleted = await deleteEvent(id);
  if (!deleted) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  return NextResponse.json({ message: "Event deleted." });
}
