import { NextResponse } from "next/server";
import { finishEventAndSendEvaluations } from "@/lib/engagement";
import { deleteEvent, getEventById, updateEvent } from "@/lib/events";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  return NextResponse.json({ event });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const previous = await getEventById(id);

    // Saving status as Finished should also send evaluation invites immediately.
    if (body.status === "finished" && previous?.status !== "finished") {
      const result = await finishEventAndSendEvaluations(id);
      const rest = { ...body };
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

    const event = await updateEvent(id, body);

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
  const { id } = await params;
  const deleted = await deleteEvent(id);
  if (!deleted) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  return NextResponse.json({ message: "Event deleted." });
}
