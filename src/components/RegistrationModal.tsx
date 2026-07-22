"use client";

import { Modal } from "@/components/ui/Modal";
import { RegistrationForm } from "@/components/RegistrationForm";
import { RegistrationSidebar } from "@/components/RegistrationSidebar";
import { conference } from "@/lib/conference";

const REGISTRATION_STEPS = [
  "Personal",
  "Professional",
  "Address",
  "Payment",
  "Review",
] as const;

interface RegistrationModalProps {
  open: boolean;
  onClose: () => void;
  eventId?: string | null;
}

export function RegistrationModal({ open, onClose, eventId = null }: RegistrationModalProps) {
  return (
    <Modal open={open} onClose={onClose} size="large" hideHeader contentClassName="p-0">
      <div className="registration-modal-layout">
        <div className="registration-modal-main">
          <div className="registration-modal-main-header">
            <div>
              <h2 id="modal-title" className="registration-modal-page-title font-display">
                {conference.pages.register.title}
              </h2>
              <p className="registration-modal-page-subtitle mb-0">{conference.conferenceName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="registration-modal-close registration-modal-close-light"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="registration-modal-stepper" aria-label="Registration progress">
            {REGISTRATION_STEPS.map((label, index) => {
              const step = index + 1;
              const isActive = step === 1;
              const isComplete = false;

              return (
                <div
                  key={label}
                  className={`registration-modal-step${isActive ? " is-active" : ""}${isComplete ? " is-complete" : ""}`}
                >
                  <span className="registration-modal-step-index">{step}</span>
                  <span className="registration-modal-step-label">{label}</span>
                </div>
              );
            })}
          </div>

          <div className="registration-modal-form">
            <RegistrationForm eventId={eventId} onCompleted={onClose} onBack={onClose} />
          </div>
        </div>

        <RegistrationSidebar eventId={eventId} />
      </div>
    </Modal>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
