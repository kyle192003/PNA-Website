"use client";

import Link from "next/link";
import type { PublicEvent } from "@/lib/types/admin";
import { RegisterButton } from "@/components/RegisterButton";
import { PillArrowIcon } from "@/components/ui/PillArrow";
import { getEventCardBlurb, splitEventTitleYear } from "@/lib/event-utils";
import { VenueMapEmbed } from "@/components/VenueMapEmbed";
import { useEventOverview } from "@/providers/EventOverviewProvider";

type EventCardVariant = "default" | "compact" | "featured" | "listing";

export function EventCard({
  event,
  variant = "default",
}: {
  event: PublicEvent;
  variant?: EventCardVariant;
  compact?: boolean;
}) {
  const isOpen = event.status === "open";
  const isFeatured = variant === "featured";
  const { openEventOverview } = useEventOverview();

  if (isFeatured) {
    const { year, rest: titleRest } = splitEventTitleYear(event.title);

    return (
      <article className="event-card event-card--featured">
        <div className="event-card-featured-shell">
          <div className="event-card-featured-panel">
            <div className="event-card-featured-pattern" aria-hidden="true" />

            <div className="event-card-featured-badges">
              <span className={`event-card-featured-status event-card-featured-status--${event.status}`}>
                <span aria-hidden="true">●</span>
                {isOpen ? "Registration Open" : "Upcoming Soon"}
              </span>
              <span className="event-card-featured-badge">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 3.5l2.35 4.76 5.25.77-3.8 3.7.9 5.23L12 15.9l-4.7 2.47.9-5.23-3.8-3.7 5.25-.77L12 3.5Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                Featured on Homepage
              </span>
            </div>

            <h3 className="event-card-featured-title font-display">
              {year ? <span className="event-card-featured-year">{year}</span> : null}
              <span>{year ? titleRest : event.title}</span>
            </h3>

            <div className="event-card-featured-rule" aria-hidden="true" />

            {event.theme ? (
              <p className="event-card-featured-theme font-display">{event.theme}</p>
            ) : null}

            <p className="event-card-featured-desc">{getEventCardBlurb(event.description)}</p>

            <div className="event-card-featured-actions">
              {isOpen ? (
                <RegisterButton
                  eventId={event.id}
                  className="event-card-featured-btn event-card-featured-btn--primary"
                  showArrow={false}
                  alwaysShow
                >
                  <FeaturedRegisterIcon />
                  Register for This Event
                  <FeaturedArrowIcon />
                </RegisterButton>
              ) : (
                <span className="event-card-featured-soon">Registration opens soon</span>
              )}
              <button
                type="button"
                className="event-card-featured-btn event-card-featured-btn--ghost"
                onClick={() => openEventOverview(event)}
              >
                <FeaturedInfoIcon />
                View Event Details
                <FeaturedArrowIcon />
              </button>
            </div>
          </div>

          <aside className="event-card-featured-sidebar">
            <div className="event-card-featured-detail">
              <span className="event-card-featured-detail-icon" aria-hidden="true">
                <FeaturedCalendarIcon />
              </span>
              <div className="event-card-featured-detail-body">
                <p className="event-card-featured-detail-label">Dates</p>
                <p className="event-card-featured-detail-value">
                  {event.datesDisplay || "To be announced"}
                </p>
              </div>
            </div>

            <div className="event-card-featured-detail event-card-featured-detail--venue">
              <span className="event-card-featured-detail-icon" aria-hidden="true">
                <FeaturedPinIcon />
              </span>
              <div className="event-card-featured-detail-body">
                <p className="event-card-featured-detail-label">Venue</p>
                <p className="event-card-featured-detail-value event-card-featured-detail-value--venue">
                  {event.venueName || "To be announced"}
                </p>
                {event.venueAddress ? (
                  <p className="event-card-featured-detail-sub">{event.venueAddress}</p>
                ) : null}
              </div>
              <VenueMapEmbed
                venue={event}
                title={`Map of ${event.venueName || event.title}`}
                showLink
                linkVariant="overlay"
                className="event-maps-block--featured"
              />
            </div>

            {event.earlyBirdDeadline ? (
              <div className="event-card-featured-detail">
                <span className="event-card-featured-detail-icon" aria-hidden="true">
                  <FeaturedClockIcon />
                </span>
                <div className="event-card-featured-detail-body">
                  <p className="event-card-featured-detail-label">Early Bird Deadline</p>
                  <p className="event-card-featured-detail-value">{event.earlyBirdDeadline}</p>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </article>
    );
  }

  if (variant === "listing") {
    return (
      <article className="event-card event-card--listing">
        <div className="event-card-listing-accent" aria-hidden="true" />

        <div className="event-card-listing-main">
          <p className="event-card-listing-eyebrow">
            {isOpen ? "Registration open" : "Upcoming soon"}
          </p>
          <h3 className="event-card-listing-title font-display">{event.title}</h3>
          <p className="event-card-listing-desc">{getEventCardBlurb(event.description)}</p>
          {event.theme ? (
            <p className="event-card-listing-theme font-display">&ldquo;{event.theme}&rdquo;</p>
          ) : null}
        </div>

        <div className="event-card-listing-meta">
          <div className="event-card-listing-meta-item">
            <CalendarIcon />
            <span>{event.datesDisplay || "Dates to be announced"}</span>
          </div>
          {event.venueName ? (
            <div className="event-card-listing-meta-item">
              <PinIcon />
              <span>{event.venueName}</span>
            </div>
          ) : null}
          {isOpen && event.earlyBirdDeadline ? (
            <div className="event-card-listing-meta-item event-card-listing-meta-item--accent">
              Early bird · {event.earlyBirdDeadline}
            </div>
          ) : null}
        </div>

        <div className="event-card-listing-actions">
          <button
            type="button"
            className="event-card-listing-link"
            onClick={() => openEventOverview(event)}
          >
            View details
          </button>
          {isOpen ? (
            <RegisterButton eventId={event.id} className="btn-pill-arrow btn-sm-pill" alwaysShow>
              Register
            </RegisterButton>
          ) : (
            <span className="event-card-listing-soon">Opens soon</span>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className={`event-card event-card--${variant}${variant === "compact" ? " event-card--green" : ""}`}>
      <div className="event-card-header">
        <span className={`event-card-status event-card-status--${event.status}`}>
          {isOpen ? "Registration Open" : "Upcoming Soon"}
        </span>
        {!isOpen && (
          <span className="event-card-note">Details may change before registration opens.</span>
        )}
      </div>

      <div className="event-card-body">
        <div className="event-card-copy">
          <h3 className="event-card-title font-display">{event.title}</h3>
          {event.theme && (
            <p className="event-card-theme font-display">&ldquo;{event.theme}&rdquo;</p>
          )}
          {variant !== "compact" && <p className="event-card-desc">{event.description}</p>}
        </div>

        <dl className="event-card-meta">
          <div className="event-card-meta-block">
            <dt>Dates</dt>
            <dd>{event.datesDisplay || "To be announced"}</dd>
          </div>
          <div className="event-card-meta-block">
            <dt>Venue</dt>
            <dd>
              <span className="event-venue-name">{event.venueName || "To be announced"}</span>
              {event.venueAddress ? (
                <span className="event-venue-address">{event.venueAddress}</span>
              ) : null}
              <VenueMapEmbed venue={event} title={`Map of ${event.venueName || event.title}`} />
            </dd>
          </div>
          {isOpen && event.earlyBirdDeadline ? (
            <div className="event-card-meta-block">
              <dt>Early Bird Deadline</dt>
              <dd>{event.earlyBirdDeadline}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="event-card-actions">
        <button
          type="button"
          className="btn-pill-arrow btn-pill-arrow--outline"
          onClick={() => openEventOverview(event)}
        >
          View Event Overview
          <span className="btn-pill-arrow-icon" aria-hidden="true">
            <PillArrowIcon />
          </span>
        </button>
        {isOpen ? (
          <RegisterButton eventId={event.id} className="btn-pill-arrow" alwaysShow>
            Register for This Event
          </RegisterButton>
        ) : (
          <span className="event-card-soon-badge">Registration opens soon</span>
        )}
        {variant === "default" && (
          <Link href="/events" className="btn-pill-arrow btn-pill-arrow--outline">
            View All Events
            <span className="btn-pill-arrow-icon" aria-hidden="true">
              <PillArrowIcon />
            </span>
          </Link>
        )}
      </div>
    </article>
  );
}

function FeaturedRegisterIcon() {
  return (
    <svg className="event-card-featured-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M6 19c0-3.314 2.686-5 6-5s6 1.686 6 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M18 5v4M16 7h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function FeaturedInfoIcon() {
  return (
    <svg className="event-card-featured-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" />
    </svg>
  );
}

function FeaturedArrowIcon() {
  return (
    <span className="event-card-featured-btn-arrow" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M9 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function FeaturedCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 3V7M16 3V7M4 10H20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function FeaturedPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.33 6-10a6 6 0 1 0-12 0c0 4.67 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="11" r="2.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function FeaturedClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8.5V12l2.5 2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="event-card-listing-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 3V7M16 3V7M4 10H20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="event-card-listing-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.33 6-10a6 6 0 1 0-12 0c0 4.67 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="11" r="2.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
