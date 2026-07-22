"use client";

import type { PublicEvent } from "@/lib/types/admin";
import { buildVenueMapsUrl } from "@/lib/event-utils";
import { EventSpeakersList } from "@/components/EventSpeakersList";
import { Modal } from "@/components/ui/Modal";
import { PillArrowIcon } from "@/components/ui/PillArrow";

interface EventOverviewModalProps {
  open: boolean;
  event: PublicEvent | null;
  onClose: () => void;
  onRegisterNow: (eventId: string) => void;
}

export function EventOverviewModal({
  open,
  event,
  onClose,
  onRegisterNow,
}: EventOverviewModalProps) {
  if (!open || !event) return null;

  const isOpen = event.status === "open";
  const mapsUrl = buildVenueMapsUrl(event);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = encodeURIComponent(event.title);
  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${shareTitle}&url=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    email: `mailto:?subject=${shareTitle}&body=${encodeURIComponent(shareUrl)}`,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="overview"
      hideHeader
      containScroll
      contentClassName="p-0"
      dialogClassName="event-overview-dialog"
    >
      <div className="event-overview-modal">
        {/* Header */}
        <div className="event-overview-modal-head">
          <div className="event-overview-modal-head-copy">
            <h2 className="event-overview-modal-title font-display">{event.title}</h2>
            <div className="event-overview-modal-intro">
              {event.theme ? (
                <p className="event-overview-modal-theme font-display">
                  &ldquo;{event.theme}&rdquo;
                </p>
              ) : (
                <span />
              )}
              <span
                className={`event-overview-status event-card-status event-card-status--${event.status}`}
              >
                <span className="event-overview-status-dot" aria-hidden="true">
                  ●
                </span>
                {isOpen ? "Registration Open" : "Upcoming Soon"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="event-overview-modal-close"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body: two-column layout */}
        <div className="event-overview-modal-body">
          <div className="event-overview-two-col">
            {/* Left: event overview text */}
            <div className="event-overview-main">
              <h3 className="event-overview-heading font-display">Event Overview</h3>
              <p className="event-overview-description-text">{event.description}</p>
            </div>

            {/* Right: sidebar */}
            <aside className="event-overview-sidebar">
              {/* Dates */}
              {event.datesDisplay ? (
                <div className="event-overview-sb-block">
                  <div className="event-overview-sb-icon-row">
                    <SbCalendarIcon />
                    <span className="event-overview-sb-value">{event.datesDisplay}</span>
                  </div>
                </div>
              ) : null}

              {/* Location */}
              <div className="event-overview-sb-block">
                <p className="event-overview-sb-label">Location</p>
                <p className="event-overview-sb-venue">{event.venueName || "To be announced"}</p>
                {event.venueAddress ? (
                  <p className="event-overview-sb-address">{event.venueAddress}</p>
                ) : null}
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-overview-view-map"
                  >
                    View Map
                  </a>
                ) : null}
              </div>

              {/* Share */}
              <div className="event-overview-sb-block">
                <p className="event-overview-sb-label">Share With Friends</p>
                <div className="event-overview-share-row">
                  <a
                    href={shareLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-overview-share-btn"
                    aria-label="Share on Facebook"
                  >
                    <FacebookIcon />
                  </a>
                  <a
                    href={shareLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-overview-share-btn"
                    aria-label="Share on X / Twitter"
                  >
                    <TwitterXIcon />
                  </a>
                  <a
                    href={shareLinks.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-overview-share-btn"
                    aria-label="Share on LinkedIn"
                  >
                    <LinkedInIcon />
                  </a>
                  <a
                    href={shareLinks.email}
                    className="event-overview-share-btn"
                    aria-label="Share via Email"
                  >
                    <EmailIcon />
                  </a>
                </div>
              </div>
            </aside>
          </div>

          {/* Speakers — full width below two-column area */}
          {event.speakers.length > 0 ? (
            <div className="event-overview-speakers-wrap">
              <EventSpeakersList
                speakers={event.speakers}
                intro={`Meet the distinguished leaders and subject-matter experts presenting at ${event.title}.`}
              />
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="event-overview-modal-footer">
          {isOpen ? (
            <button
              type="button"
              className="btn-pill-arrow w-100 justify-content-center"
              onClick={() => onRegisterNow(event.id)}
            >
              Register Now
              <span className="btn-pill-arrow-icon" aria-hidden="true">
                <PillArrowIcon />
              </span>
            </button>
          ) : (
            <span className="event-card-soon-badge w-100 justify-content-center">
              Registration opens soon
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ── Sidebar icons ── */

function SbCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 3V7M16 3V7M4 10H20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/* ── Share icons ── */

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function TwitterXIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M2 7l10 7 10-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
