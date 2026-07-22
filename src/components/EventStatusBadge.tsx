import type { EventStatus } from "@/lib/types/admin";
import { EVENT_STATUS_LABELS } from "@/lib/types/admin";

const toneClass: Record<EventStatus, string> = {
  draft: "event-status-badge--draft",
  upcoming: "event-status-badge--upcoming",
  open: "event-status-badge--open",
  finished: "event-status-badge--finished",
};

export function EventStatusBadge({
  status,
  className = "",
}: {
  status: EventStatus;
  className?: string;
}) {
  return (
    <span className={`event-status-badge ${toneClass[status]} ${className}`.trim()}>
      {EVENT_STATUS_LABELS[status]}
    </span>
  );
}
