import Link from "next/link";
import { getAllEvents } from "@/lib/events";
import { AdminEventsTable } from "@/components/admin/AdminEventsTable";

export default async function AdminEventsPage() {
  const events = await getAllEvents();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display">Events</h1>
          <p className="admin-muted">
            Create events, mark programs as upcoming soon, and open registration when ready.
          </p>
        </div>
        <Link
          href="/admin/events/new"
          className="admin-btn-primary"
          style={{
            color: "#ffffff",
            background: "linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            borderRadius: "9999px",
            padding: "0.8rem 1.6rem",
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          New Event
        </Link>
      </div>

      <div className="admin-card admin-table-wrap">
        {events.length === 0 ? (
          <p className="admin-muted p-3 mb-0">No events created yet.</p>
        ) : (
          <AdminEventsTable events={events} />
        )}
      </div>
    </div>
  );
}
