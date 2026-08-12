import { NextResponse } from "next/server";
import { getAllRegistrations } from "@/lib/registrations";
import {
  compareParticipantsByName,
  getParticipantSearchText,
} from "@/lib/participant-name";
import { requireAdminSession } from "@/lib/security/require-admin";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const eventId = searchParams.get("eventId");
  const query = searchParams.get("q")?.toLowerCase().trim();

  let registrations = await getAllRegistrations();

  if (status) {
    registrations = registrations.filter((r) => r.paymentStatus === status);
  }

  if (eventId === "unassigned") {
    registrations = registrations.filter((r) => !r.eventId);
  } else if (eventId) {
    registrations = registrations.filter((r) => r.eventId === eventId);
  }

  if (query) {
    registrations = registrations.filter((r) =>
      getParticipantSearchText(r).includes(query)
    );
  }

  registrations.sort(compareParticipantsByName);

  return NextResponse.json({ registrations });
}
