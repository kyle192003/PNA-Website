"use client";

import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { RegistrationForm } from "@/components/RegistrationForm";
import {
  RegistrationSidebar,
  type RegistrationPaymentBreakdown,
} from "@/components/RegistrationSidebar";
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
  inviteToken?: string | null;
  inviteEmail?: string | null;
  inviteFirstName?: string | null;
  inviteSpecialRole?: "committee" | "speaker" | null;
  inviteEventTitle?: string | null;
}

export function RegistrationModal({
  open,
  onClose,
  eventId = null,
  inviteToken = null,
  inviteEmail = null,
  inviteFirstName = null,
  inviteSpecialRole = null,
  inviteEventTitle = null,
}: RegistrationModalProps) {
  const [steps, setSteps] = useState<RegistrationStepState[]>(INITIAL_STEPS);
  const [paymentBreakdown, setPaymentBreakdown] = useState<RegistrationPaymentBreakdown | null>(
    null
  );
  const specialLane = Boolean(inviteToken);

  const handleStepStatesChange = useCallback((next: RegistrationStepState[]) => {
    setSteps(next);
  }, []);

  const handlePaymentBreakdownChange = useCallback(
    (next: RegistrationPaymentBreakdown | null) => {
      setPaymentBreakdown(next);
    },
    []
  );

  const handleClose = useCallback(() => {
    setSteps(INITIAL_STEPS);
    setPaymentBreakdown(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="large"
      hideHeader
      containScroll
      contentClassName="p-0"
      dialogClassName="registration-modal-dialog"
      labelledBy="registration-modal-title"
    >
      <div className="registration-modal-layout">
        <div className="registration-modal-main">
          <div className="registration-modal-chrome">
            <div className="registration-modal-main-header">
              <div>
                <h2 id="registration-modal-title" className="registration-modal-page-title font-display">
                  {specialLane
                    ? inviteSpecialRole === "committee"
                      ? "Exclusive Committee Registration"
                      : inviteSpecialRole === "speaker"
                        ? "Exclusive Guest Speaker Registration"
                        : "Exclusive Committee / Speaker Registration"
                    : conference.pages.register.title}
                </h2>
                <p className="registration-modal-page-subtitle mb-0">
                  {inviteEventTitle || conference.conferenceName}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="registration-modal-close registration-modal-close-light"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <RegistrationStepper steps={steps} />
          </div>

          <div className="registration-modal-form">
            <RegistrationForm
              eventId={eventId}
              inviteToken={inviteToken}
              inviteEmail={inviteEmail}
              inviteFirstName={inviteFirstName}
              inviteSpecialRole={inviteSpecialRole}
              inviteEventTitle={inviteEventTitle}
              onCompleted={handleClose}
              onBack={handleClose}
              onStepStatesChange={handleStepStatesChange}
              onPaymentBreakdownChange={handlePaymentBreakdownChange}
            />
          </div>
        </div>

        <RegistrationSidebar
          eventId={eventId}
          paymentBreakdown={paymentBreakdown}
        />
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
