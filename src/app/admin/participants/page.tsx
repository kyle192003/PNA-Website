import { ParticipantsTable } from "@/components/admin/ParticipantsTable";
import { getAllEvents } from "@/lib/events";
import { getParticipantInsightStats } from "@/lib/financial-stats";
import { getAllRegistrations } from "@/lib/registrations";

export default async function AdminParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; eventId?: string }>;
}) {
  const { q, eventId } = await searchParams;
  const [events, registrations] = await Promise.all([
    getAllEvents(),
    getAllRegistrations(),
  ]);

  const participantCounts: Record<string, number> = {};
  for (const registration of registrations) {
    const key = registration.eventId ?? "unassigned";
    participantCounts[key] = (participantCounts[key] ?? 0) + 1;
  }

  const resolvedEventId =
    eventId && (eventId === "unassigned" || events.some((event) => event.id === eventId))
      ? eventId
      : events[0]?.id ?? "unassigned";

  const insights = await getParticipantInsightStats(resolvedEventId);

  return (
    <ParticipantsTable
      events={events}
      initialQuery={q ?? ""}
      initialEventId={resolvedEventId}
      participantCounts={participantCounts}
      insights={insights}
    />
  );
}
