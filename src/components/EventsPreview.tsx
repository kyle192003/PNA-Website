import Link from "next/link";
import type { PublicEvent } from "@/lib/types/admin";
import { conference } from "@/lib/conference";
import { EventCard } from "@/components/EventCard";
import { Section } from "@/components/Section";

export function EventsPreview({
  featured,
  others,
}: {
  featured: PublicEvent | null;
  others: PublicEvent[];
}) {
  if (!featured) return null;

  return (
    <Section className="folio-section--white">
      <div className="folio-section-head folio-section-head--editorial">
        <div>
          <p className="folio-eyebrow folio-eyebrow--caps">Conference Calendar</p>
          <h2 className="folio-editorial-title font-display mb-3">Events &amp; Upcoming Programs</h2>
          <p className="folio-editorial-lead mb-0">
            Browse open registrations and upcoming programs hosted by the {conference.organization}.
          </p>
        </div>
        <Link href="/events" className="btn-editorial btn-editorial--outline d-none d-md-inline-flex">
          View All Events
        </Link>
      </div>

      <div className="events-preview-layout">
        <EventCard event={featured} variant="featured" />

        {others.length > 0 && (
          <div className="events-preview-others">
            <h3 className="events-preview-others-title font-display">More Events</h3>
            <div className="events-preview-grid">
              {others.map((event) => (
                <EventCard key={event.id} event={event} variant="compact" />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-center d-md-none mt-4">
        <Link href="/events" className="btn-editorial btn-editorial--outline">
          View All Events
        </Link>
      </div>
    </Section>
  );
}
