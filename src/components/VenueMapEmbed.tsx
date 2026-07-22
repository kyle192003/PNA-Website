import { buildVenueMapsEmbedUrl, buildVenueMapsUrl } from "@/lib/event-utils";

type VenueMapFields = {
  venueName?: string | null;
  venueAddress?: string | null;
  venueMapsUrl?: string | null;
};

export function VenueMapEmbed({
  venue,
  title,
  showLink = false,
  linkVariant = "below",
  className = "",
}: {
  venue: VenueMapFields;
  title?: string;
  showLink?: boolean;
  linkVariant?: "below" | "overlay";
  className?: string;
}) {
  const embedUrl = buildVenueMapsEmbedUrl(venue);
  const mapsUrl = buildVenueMapsUrl(venue);

  if (!embedUrl) return null;

  const mapTitle = title ?? `Map of ${venue.venueName || "event venue"}`;
  const showOverlay = showLink && linkVariant === "overlay" && mapsUrl;
  const showBelow = showLink && linkVariant === "below" && mapsUrl;

  return (
    <div className={`event-maps-block ${className}`.trim()}>
      <div className="event-maps-embed-wrap">
        <iframe
          title={mapTitle}
          src={embedUrl}
          className="event-maps-embed"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        {showOverlay ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="event-maps-overlay-link"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M14 5h5v5M10 14L19 5M19 12v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Open in Maps
          </a>
        ) : null}
      </div>
      {showBelow ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="event-maps-link"
        >
          Open in Google Maps
        </a>
      ) : null}
    </div>
  );
}
