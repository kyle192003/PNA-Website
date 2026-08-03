"use client";

import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { RegistrationForm } from "@/components/RegistrationForm";
import { RegistrationSidebar } from "@/components/RegistrationSidebar";
import { RegistrationStepper } from "@/components/RegistrationStepper";
import { conference } from "@/lib/conference";
import {
  REGISTRATION_STEPS,
  type RegistrationStepState,
} from "@/lib/registration-steps";

const INITIAL_STEPS: RegistrationStepState[] = REGISTRATION_STEPS.map((label, index) => ({
  label,
  status: index === 0 ? "active" : "pending",
}));

interface RegistrationModalProps {
  open: boolean;
  onClose: () => void;
  eventId?: string | null;
}

export function RegistrationModal({ open, onClose, eventId = null }: RegistrationModalProps) {
  const [steps, setSteps] = useState<RegistrationStepState[]>(INITIAL_STEPS);

  const handleStepStatesChange = useCallback((next: RegistrationStepState[]) => {
    setSteps(next);
  }, []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="large"
      hideHeader
      containScroll
      contentClassName="p-0"
      dialogClassName="registration-modal-dialog"
    >
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

          <RegistrationStepper steps={steps} />

          <div className="registration-modal-form">
            <RegistrationForm
              eventId={eventId}
              onCompleted={onClose}
              onBack={onClose}
              onStepStatesChange={handleStepStatesChange}
            />
          </div>
        </div>

        <RegistrationSidebar eventId={eventId} showPaymentQr={false} />
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
