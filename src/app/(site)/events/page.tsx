import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { EventCard } from "@/components/EventCard";
import { getPublicEvents } from "@/lib/events";
import { conference } from "@/lib/conference";
import { PillArrowIcon } from "@/components/ui/PillArrow";

export const metadata: Metadata = {
  title: "Events",
  description: `Browse open registrations and upcoming programs from the ${conference.organization}.`,
};

export default async function EventsPage() {
  const events = await getPublicEvents();
  const openEvents = events.filter((event) => event.status === "open");
  const upcomingEvents = events.filter((event) => event.status === "upcoming");

  return (
    <>
      <PageHeader
        title="Events & Programs"
        subtitle={`Join open registrations or preview upcoming conferences and assemblies hosted by the ${conference.organization}.`}
        imageSrc="/images/front_speak2.JPG"
      />

      <Section className="events-page-section">
        {events.length === 0 ? (
          <div className="events-empty glass-card p-4 p-md-5 text-center">
            <h2 className="font-display h4 text-ink mb-2">No public events yet</h2>
            <p className="text-muted mb-4">
              New programs will appear here when the secretariat publishes them. Please check back
              soon or contact the conference office for assistance.
            </p>
            <Link href="/contact" className="btn-pill-arrow">
              Contact Secretariat
              <span className="btn-pill-arrow-icon" aria-hidden="true">
                <PillArrowIcon />
              </span>
            </Link>
          </div>
        ) : (
          <div className="events-page-grid">
            {openEvents.length > 0 && (
              <div className="events-page-group pna-reveal">
                <div className="events-page-group-head">
                  <h2 className="events-page-group-title font-display">Open for Registration</h2>
                  <p className="events-page-group-desc">
                    Select an event below to complete your official registration and payment.
                  </p>
                </div>
                <div className="events-list events-list--listing">
                  {openEvents.map((event) => (
                    <EventCard key={event.id} event={event} variant="listing" />
                  ))}
                </div>
              </div>
            )}

            {upcomingEvents.length > 0 && (
              <div className="events-page-group pna-reveal">
                <div className="events-page-group-head">
                  <h2 className="events-page-group-title font-display">Upcoming Soon</h2>
                  <p className="events-page-group-desc">
                    These programs are being finalized. Registration will open once details are
                    confirmed.
                  </p>
                </div>
                <div className="events-list events-list--listing">
                  {upcomingEvents.map((event) => (
                    <EventCard key={event.id} event={event} variant="listing" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>
    </>
  );
}
