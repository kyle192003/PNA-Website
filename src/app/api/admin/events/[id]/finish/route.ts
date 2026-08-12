import { NextResponse } from "next/server";
import { finishEventAndSendEvaluations } from "@/lib/engagement";
import { requireAdminSession } from "@/lib/security/require-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const result = await finishEventAndSendEvaluations(id);

    return NextResponse.json({
      event: result.event,
      invites: result.invites,
      message:
        result.invites.invitesSent > 0
          ? `Event marked finished. Sent ${result.invites.invitesSent} evaluation invite${result.invites.invitesSent === 1 ? "" : "s"}.`
          : "Event marked finished. No new evaluation invites were needed (participants may already have been invited, or none are paid and checked in).",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to finish event.";
    const status = message === "Event not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
