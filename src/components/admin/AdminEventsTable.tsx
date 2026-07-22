"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ConferenceEvent } from "@/lib/types/admin";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import { PaymentQrTableCell, RegistrationQrTableCell } from "@/components/admin/EventQrTableCells";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useConfirmAction } from "@/hooks/use-confirm-action";

export function AdminEventsTable({
  events,
  limit,
  showActions = true,
}: {
  events: ConferenceEvent[];
  limit?: number;
  showActions?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(() => (limit ? events.slice(0, limit) : events));
  const confirmHook = useConfirmAction();
  const { loading: finishing, requestConfirm } = confirmHook;

  useEffect(() => {
    setRows(limit ? events.slice(0, limit) : events);
  }, [events, limit]);

  if (rows.length === 0) {
    return null;
  }

  function requestFinishEvent(event: ConferenceEvent) {
    requestConfirm({
      title: "Finish this event?",
      message: `Mark “${event.title}” as Finished? This closes the event for the public, removes it from the homepage highlight, and emails evaluation forms to paid participants who checked in.\n\nThis action cannot be undone. Evaluation invites that are sent cannot be recalled.`,
      tagline: "Once finished, registration stays closed and evaluation emails go out automatically.",
      confirmLabel: "Yes, finish event",
      variant: "danger",
      loadingMessage: "Finishing event and sending evaluation invites...",
      successTitle: "Event finished successfully",
      successMessage:
        "The event is now Finished. Evaluation invites were sent to eligible participants.",
      action: async () => {
        const res = await fetch(`/api/admin/events/${event.id}/finish`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to finish event.");
        }

        const updated = data.event as ConferenceEvent;
        setRows((current) =>
          current.map((row) => (row.id === updated.id ? updated : row))
        );
        router.refresh();

        return typeof data.message === "string" ? data.message : undefined;
      },
    });
  }

  return (
    <>
      <LoadingOverlay show={finishing} scope="local" variant="form" />
      <ActionConfirmDialogs hook={confirmHook} />

      <table className="admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Dates</th>
            {limit ? null : <th>Venue</th>}
            <th>Status</th>
            <th>Featured</th>
            <th>Reg. QR</th>
            <th>Payment QR</th>
            {showActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((event) => {
            const isFinished = event.status === "finished";

            return (
              <tr key={event.id}>
                <td>
                  <Link href={`/admin/events/${event.id}`} className="admin-link">
                    {event.title}
                  </Link>
                </td>
                <td>{event.datesDisplay}</td>
                {limit ? null : <td>{event.venueName}</td>}
                <td>
                  <EventStatusBadge status={event.status} />
                </td>
                <td>
                  {event.featuredOnHomepage ? (
                    <span className="admin-featured-tag">Homepage highlight</span>
                  ) : (
                    <span className="admin-muted">Not featured</span>
                  )}
                </td>
                <td>
                  <RegistrationQrTableCell
                    eventId={event.id}
                    eventTitle={event.title}
                    qrCodeUrl={event.registrationQrCodeUrl}
                  />
                </td>
                <td>
                  <PaymentQrTableCell
                    eventId={event.id}
                    eventTitle={event.title}
                    qrCodeUrl={event.qrCodeUrl}
                  />
                </td>
                {showActions ? (
                  <td>
                    {isFinished ? (
                      <span className="admin-muted">No actions</span>
                    ) : (
                      <div className="admin-events-table-actions">
                        <button
                          type="button"
                          className="admin-events-finish-btn"
                          onClick={() => requestFinishEvent(event)}
                          disabled={finishing}
                        >
                          <svg
                            className="admin-events-finish-btn-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M5 13l4 4L19 7"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Finish event
                        </button>
                      </div>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
