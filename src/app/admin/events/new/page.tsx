"use client";

import { useRouter } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";

export default function NewEventPage() {
  const router = useRouter();

  async function handleSubmit(
    data: Record<string, unknown>,
    options?: { qrFile?: File | null }
  ) {
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error ?? "Failed to create event.");

    const eventId = result.event?.id as string | undefined;
    const qrFile = options?.qrFile;

    if (eventId && qrFile) {
      const formData = new FormData();
      formData.set("file", qrFile);
      formData.set(
        "showQrInRegistration",
        data.showQrInRegistration ? "true" : "false"
      );

      const qrRes = await fetch(`/api/admin/events/${eventId}/qr`, {
        method: "POST",
        body: formData,
      });
      const qrResult = await qrRes.json();
      if (!qrRes.ok) {
        throw new Error(
          qrResult.error ??
            "Event was created, but the QR upload failed. You can upload it from the event page."
        );
      }
    }

    router.push(`/admin/events/${result.event.id}`);
    router.refresh();
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display">Create Event</h1>
          <p className="admin-muted">Set up a new conference event.</p>
        </div>
      </div>

      <div className="admin-card">
        <EventForm
          onSubmit={handleSubmit}
          submitLabel="Create Event"
          showQrUpload
        />
      </div>
    </div>
  );
}
