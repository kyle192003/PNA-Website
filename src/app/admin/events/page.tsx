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
        <Link href="/admin/events/new" className="btn-primary">
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
