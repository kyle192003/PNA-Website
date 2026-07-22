"use client";

import { useRouter } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";

export default function NewEventPage() {
  const router = useRouter();

  async function handleSubmit(data: Record<string, unknown>) {
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error ?? "Failed to create event.");

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
        <EventForm onSubmit={handleSubmit} submitLabel="Create Event" />
      </div>
    </div>
  );
}
