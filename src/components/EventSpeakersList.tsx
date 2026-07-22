import Image from "next/image";
import type { EventSpeaker } from "@/lib/types/admin";
import { getSpeakerInitials } from "@/lib/speaker-utils";

export function EventSpeakersList({
  speakers,
  intro = "Meet the distinguished leaders and subject-matter experts presenting sessions at this conference.",
}: {
  speakers: EventSpeaker[];
  intro?: string;
}) {
  if (speakers.length === 0) {
    return (
      <div className="event-speakers-section">
        <div className="event-speakers-head">
          <div className="event-speakers-head-copy">
            <p className="event-speakers-eyebrow">
              Event Speakers <sup>{speakers.length}</sup>
            </p>
            <h2 className="event-speakers-title font-display">The Voices Behind the Program</h2>
          </div>
          <p className="event-speakers-intro">{intro}</p>
        </div>
        <p className="event-overview-empty mb-0">
          Speaker lineup for this event will be announced soon.
        </p>
      </div>
    );
  }

  return (
    <div className="event-speakers-section">
      <div className="event-speakers-head">
        <div className="event-speakers-head-copy">
          <p className="event-speakers-eyebrow">
            Event Speakers <sup>{speakers.length}</sup>
          </p>
          <h2 className="event-speakers-title font-display">The Voices Behind the Program</h2>
        </div>
        <p className="event-speakers-intro">{intro}</p>
      </div>

      <div className="event-speakers-grid">
        {speakers.map((speaker) => (
          <article key={speaker.id} className="event-speaker-card">
            <div className="event-speaker-portrait">
              {speaker.imageUrl ? (
                <Image
                  src={speaker.imageUrl}
                  alt={speaker.name}
                  fill
                  className="event-speaker-portrait-image object-fit-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                />
              ) : (
                <div className="event-speaker-portrait-placeholder font-display">
                  {getSpeakerInitials(speaker.name)}
                </div>
              )}
            </div>

            <div className="event-speaker-card-body">
              {speaker.title && <p className="event-speaker-role">{speaker.title}</p>}
              <h3 className="event-speaker-name font-display">{speaker.name}</h3>
              {speaker.organization && (
                <p className="event-speaker-organization">{speaker.organization}</p>
              )}

              <div className="event-speaker-cta event-speaker-cta--static">
                <span className="event-speaker-cta-dot" aria-hidden="true" />
                Conference Speaker
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
