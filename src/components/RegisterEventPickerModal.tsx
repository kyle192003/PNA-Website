"use client";

import type { PublicEvent } from "@/lib/types/admin";
import { Modal } from "@/components/ui/Modal";
import { PillArrowIcon } from "@/components/ui/PillArrow";

interface RegisterEventPickerModalProps {
  open: boolean;
  events: PublicEvent[];
  onClose: () => void;
  onSelectEvent: (eventId: string) => void;
}

export function RegisterEventPickerModal({
  open,
  events,
  onClose,
  onSelectEvent,
}: RegisterEventPickerModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose an Event"
      contentClassName="p-4 sm:p-6"
    >
      <p className="register-event-picker-intro mb-0">
        Select the conference you would like to register for.
      </p>

      {events.length === 0 ? (
        <p className="register-event-picker-empty mb-0">
          No events are open for registration at the moment. Please check back soon.
        </p>
      ) : (
        <ul className="register-event-picker-list list-unstyled mb-0">
          {events.map((event) => {
            const isOpen = event.status === "open";

            return (
              <li key={event.id}>
                <button
                  type="button"
                  className={`register-event-picker-option ${
                    isOpen ? "" : "register-event-picker-option--disabled"
                  }`}
                  onClick={() => isOpen && onSelectEvent(event.id)}
                  disabled={!isOpen}
                >
                  <span className="register-event-picker-option-main">
                    <span className="register-event-picker-option-title font-display">
                      {event.title}
                    </span>
                    {event.theme && (
                      <span className="register-event-picker-option-theme">
                        &ldquo;{event.theme}&rdquo;
                      </span>
                    )}
                    <span className="register-event-picker-option-meta">
                      {event.datesDisplay || "Dates to be announced"}
                      {event.venueName ? ` · ${event.venueName}` : ""}
                    </span>
                  </span>

                  <span className="register-event-picker-option-action">
                    {isOpen ? (
                      <>
                        <span>Register</span>
                        <span className="register-event-picker-option-icon" aria-hidden="true">
                          <PillArrowIcon />
                        </span>
                      </>
                    ) : (
                      <span className="event-card-soon-badge">Registration opens soon</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
