"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";
import { EventSpeakersPanel } from "@/components/admin/EventSpeakersPanel";
import { QrUploadPanel } from "@/components/admin/QrUploadPanel";
import { RegistrationQrPanel } from "@/components/admin/RegistrationQrPanel";
import { CertificateTemplatePanel } from "@/components/admin/CertificateTemplatePanel";
import { EventStatusBadge } from "@/components/EventStatusBadge";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { AdminEditPageSkeleton } from "@/components/ui/Skeleton";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import type { ConferenceEvent } from "@/lib/types/admin";

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const [event, setEvent] = useState<ConferenceEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finishMessage, setFinishMessage] = useState<string | null>(null);
  const confirmHook = useConfirmAction();
  const { loading: finishing, requestConfirm } = confirmHook;

  useDocumentTitle(event?.title ?? (loading ? "Loading event" : null));

  const loadEvent = useCallback(async () => {
    if (!eventId) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/events/${eventId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load event.");
      }

      setEvent(data.event ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event.");
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  async function handleSubmit(data: Record<string, unknown>) {
    if (!eventId) return;

    const res = await fetch(`/api/admin/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error ?? "Failed to update event.");

    setEvent(result.event);
    if (typeof result.message === "string" && result.message) {
      setFinishMessage(result.message);
    }
    router.refresh();
  }

  function requestFinishEvent() {
    if (!eventId || !event) return;

    const alreadyFinished = event.status === "finished";
    requestConfirm({
      title: alreadyFinished ? "Send evaluation invites?" : "Mark event as finished?",
      message: alreadyFinished
        ? "Email evaluation forms now to paid participants who checked in and have not received an invite yet. Certificates are sent after they submit the evaluation."
        : "This will set the event status to Finished and email evaluation forms to paid participants who checked in. Certificates are sent after they submit the evaluation.\n\nThis action cannot be undone. Evaluation invites that are sent cannot be recalled.",
      tagline: alreadyFinished
        ? "Only participants who have not received an invite yet will be emailed."
        : "Once finished, registration stays closed and evaluation emails go out automatically.",
      confirmLabel: alreadyFinished
        ? "Send evaluation invites"
        : "Mark finished & send evaluations",
      variant: "danger",
      loadingMessage: alreadyFinished
        ? "Sending evaluation invites..."
        : "Finishing event and sending evaluation invites...",
      successTitle: alreadyFinished ? "Evaluations sent" : "Event finished successfully",
      successMessage: "Evaluation invites were processed for this event.",
      action: async () => {
        const res = await fetch(`/api/admin/events/${eventId}/finish`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to finish event.");
        }
        setEvent(data.event);
        setFinishMessage(data.message ?? "Event marked finished.");
        router.refresh();
        return typeof data.message === "string" ? data.message : undefined;
      },
    });
  }

  if (loading) {
    return <AdminEditPageSkeleton />;
  }

  if (error || !event) {
    return (
      <div className="admin-page">
        <p className="admin-muted">{error || "Event not found."}</p>
      </div>
    );
  }

  const isFinished = event.status === "finished";

  return (
    <div className="admin-page admin-page--edit-event">
      <LoadingOverlay show={finishing} scope="local" variant="form" />
      <ActionConfirmDialogs hook={confirmHook} />

      <div className="admin-edit-sticky-bar">
        <div className="admin-edit-sticky-bar__copy">
          <div className="admin-edit-sticky-bar__title-row">
            <h1 className="admin-page-title font-display mb-0">{event.title}</h1>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="admin-muted mb-0">
            Edit details, certificate template, speakers, and QR codes.
          </p>
        </div>
        <div className="admin-edit-sticky-bar__actions">
          <button
            type="button"
            className="btn-pill-arrow btn-pill-arrow--outline admin-edit-sticky-bar__action"
            onClick={requestFinishEvent}
            disabled={finishing}
          >
            {isFinished ? "Send Evaluations" : "Mark Finished"}
          </button>
          <button
            type="submit"
            form="admin-event-form"
            className="btn-primary admin-edit-sticky-bar__action"
            disabled={finishing}
          >
            Save Changes
          </button>
        </div>
      </div>

      {finishMessage && (
        <p className="admin-alert admin-alert--success mb-3">{finishMessage}</p>
      )}

      <div className="admin-edit-grid">
        <div className="admin-card admin-edit-grid__main">
          <EventForm
            initial={event}
            onSubmit={handleSubmit}
            submitLabel="Save Changes"
            showBottomActions={false}
          />
        </div>

        <EventSpeakersPanel event={event} onUpdated={setEvent} />

        <div className="admin-edit-grid__qr-row">
          <RegistrationQrPanel event={event} onUpdated={setEvent} />
          <QrUploadPanel event={event} onUpdated={setEvent} />
        </div>
      </div>

      <section className="admin-card mt-3">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title font-display mb-1">Certificate for this event</h2>
            <p className="admin-muted mb-0">
              Each event has its own certificate template. Participants receive this PDF after
              submitting the evaluation.
            </p>
          </div>
        </div>
        <CertificateTemplatePanel eventId={event.id} embedded />
      </section>
    </div>
  );
}
