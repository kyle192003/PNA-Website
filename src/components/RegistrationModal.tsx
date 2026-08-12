"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Modal } from "@/components/ui/Modal";
import { RegistrationForm } from "@/components/RegistrationForm";
import {
  RegistrationSidebar,
  type RegistrationPaymentBreakdown,
} from "@/components/RegistrationSidebar";
import { RegistrationStepper } from "@/components/RegistrationStepper";
import { conference } from "@/lib/conference";
import {
  hasRegistrationPrivacyAccepted,
  saveRegistrationPrivacyAccepted,
} from "@/lib/registration-draft";
import {
  REGISTRATION_STEPS,
  type RegistrationStepState,
} from "@/lib/registration-steps";

gsap.registerPlugin(useGSAP);

const INITIAL_STEPS: RegistrationStepState[] = REGISTRATION_STEPS.map((label, index) => ({
  label,
  status: index === 0 ? "active" : "pending",
}));

const PRIVACY_TRANSITION_MS = 360;

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
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [privacyError, setPrivacyError] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const specialLane = Boolean(inviteToken);

  const stageRef = useRef<HTMLDivElement>(null);
  const privacyPanelRef = useRef<HTMLDivElement>(null);
  const formPanelRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useRef(false);

  const { contextSafe } = useGSAP({ scope: stageRef });

  const handleStepStatesChange = useCallback((next: RegistrationStepState[]) => {
    setSteps(next);
  }, []);

  const handlePaymentBreakdownChange = useCallback(
    (next: RegistrationPaymentBreakdown | null) => {
      setPaymentBreakdown(next);
    },
    []
  );

  const resetModalState = useCallback(() => {
    setSteps(INITIAL_STEPS);
    setPaymentBreakdown(null);
    setPrivacyAccepted(false);
    setPrivacyChecked(false);
    setPrivacyError(false);
    setIsTransitioning(false);
  }, []);

  const handleClose = useCallback(() => {
    resetModalState();
    onClose();
  }, [onClose, resetModalState]);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  useEffect(() => {
    if (!open) {
      resetModalState();
      return;
    }

    // Skip the privacy gate when they already agreed for this event (kept with form cache).
    if (hasRegistrationPrivacyAccepted(eventId)) {
      setPrivacyAccepted(true);
      setPrivacyChecked(true);
      setPrivacyError(false);
      setIsTransitioning(false);
      return;
    }

    setPrivacyAccepted(false);
    setPrivacyChecked(false);
    setPrivacyError(false);
    setIsTransitioning(false);
  }, [open, eventId, resetModalState]);

  // Fade the form/sidebar in when entering the form stage (including cache skip).
  useGSAP(
    () => {
      if (!open || !privacyAccepted || isTransitioning) return;

      const formEl = formPanelRef.current;
      const sidebarEl = stageRef.current?.querySelector(
        ".registration-modal-sidebar"
      ) as HTMLElement | null;
      if (!formEl) return;

      if (prefersReducedMotion.current) {
        gsap.set([formEl, sidebarEl].filter(Boolean), { opacity: 1, y: 0, x: 0 });
        return;
      }

      gsap.fromTo(
        formEl,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.38,
          ease: "power2.out",
          clearProps: "transform",
        }
      );
      if (sidebarEl) {
        gsap.fromTo(
          sidebarEl,
          { opacity: 0, x: 12 },
          {
            opacity: 1,
            x: 0,
            duration: 0.42,
            ease: "power2.out",
            delay: 0.05,
            clearProps: "transform",
          }
        );
      }
    },
    { dependencies: [open, privacyAccepted, isTransitioning], scope: stageRef }
  );

  const handlePrivacyContinue = contextSafe(() => {
    if (!privacyChecked) {
      setPrivacyError(true);
      return;
    }

    saveRegistrationPrivacyAccepted(eventId);
    setPrivacyError(false);

    const privacyEl = privacyPanelRef.current;
    if (!privacyEl || prefersReducedMotion.current) {
      setPrivacyAccepted(true);
      return;
    }

    setIsTransitioning(true);
    gsap.to(privacyEl, {
      opacity: 0,
      y: -8,
      duration: PRIVACY_TRANSITION_MS / 1000,
      ease: "power2.inOut",
      onComplete: () => {
        setPrivacyAccepted(true);
        setIsTransitioning(false);
      },
    });
  });

  const formTitle = specialLane
    ? inviteSpecialRole === "committee"
      ? "Exclusive Committee Registration"
      : inviteSpecialRole === "speaker"
        ? "Exclusive Guest Speaker Registration"
        : "Exclusive Committee / Speaker Registration"
    : conference.pages.register.title;

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
      <div
        ref={stageRef}
        className={`registration-modal-layout${
          privacyAccepted ? "" : " registration-modal-layout--privacy"
        }`}
      >
        <div className="registration-modal-main">
          <div className="registration-modal-chrome">
            <div className="registration-modal-main-header">
              <div
                key={privacyAccepted ? "form-title" : "privacy-title"}
                className="registration-privacy-title-swap"
              >
                <h2
                  id="registration-modal-title"
                  className="registration-modal-page-title font-display"
                >
                  {!privacyAccepted ? "Data Privacy Notice" : formTitle}
                </h2>
                <p className="registration-modal-page-subtitle mb-0">
                  {!privacyAccepted
                    ? "Please review before continuing to registration"
                    : inviteEventTitle || conference.conferenceName}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="registration-modal-close registration-modal-close-light"
                aria-label="Close"
                disabled={isTransitioning}
              >
                <CloseIcon />
              </button>
            </div>

            {privacyAccepted ? <RegistrationStepper steps={steps} /> : null}
          </div>

          <div className="registration-modal-form">
            {privacyAccepted ? (
              <div
                ref={formPanelRef}
                className="registration-privacy-stage-panel"
                style={{ opacity: 0 }}
              >
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
            ) : (
              <div
                ref={privacyPanelRef}
                className="registration-privacy-gate registration-privacy-stage-panel"
              >
                <p className="registration-privacy-gate-lead">
                  Before you begin registration for{" "}
                  <strong>{inviteEventTitle || conference.conferenceName}</strong>, please read this
                  notice under the Data Privacy Act of 2012 (Republic Act No. 10173).
                </p>

                <div className="registration-privacy-gate-card">
                  <section className="registration-privacy-gate-block">
                    <h3 className="registration-privacy-gate-heading">What we collect</h3>
                    <p>
                      We collect personal information needed for conference registration and
                      participation. This may include your full name, email address, mobile number,
                      date of birth, gender, membership type and PNA ID details, PRC license
                      information, institution or organization name and address, position or title,
                      food preference, payment reference and proof of payment, and any supporting
                      documents you upload (such as PRC ID, PNA ID, Senior Citizen/PWD ID, or BIR
                      forms when a sales invoice is requested).
                    </p>
                  </section>

                  <section className="registration-privacy-gate-block">
                    <h3 className="registration-privacy-gate-heading">How we use your data</h3>
                    <p>
                      Your information will be used to process and confirm registration, verify
                      eligibility and membership status, communicate event schedules and updates,
                      record attendance, issue confirmations or receipts, coordinate onsite
                      logistics, and fulfill related administrative, financial, and legal obligations
                      of the Philippine Nurses Association. We process only what is necessary for
                      these purposes and retain records as required for event administration and
                      applicable retention policies.
                    </p>
                  </section>

                  <section className="registration-privacy-gate-block">
                    <h3 className="registration-privacy-gate-heading">Your rights</h3>
                    <p>
                      Under the Data Privacy Act of 2012 (Republic Act No. 10173), you have the right
                      to be informed about how your personal data is processed; to access and request
                      correction of your personal data; to object to processing where applicable; to
                      suspend, withdraw, or remove consent subject to legal or contractual
                      requirements for event participation; and to lodge a complaint with the National
                      Privacy Commission if you believe your rights have been violated. For privacy
                      concerns related to this registration, you may contact the conference organizers
                      through the official PNA channels provided on this website.
                    </p>
                  </section>
                </div>

                <label className="registration-privacy-gate-consent">
                  <input
                    type="checkbox"
                    checked={privacyChecked}
                    onChange={(e) => {
                      setPrivacyChecked(e.target.checked);
                      if (e.target.checked) setPrivacyError(false);
                    }}
                    className="registration-form-checkbox mt-1"
                    disabled={isTransitioning}
                  />
                  <span>
                    I have read and understood this Data Privacy Notice. I consent to the collection
                    and processing of my personal data for conference registration and related
                    purposes in accordance with the Data Privacy Act of 2012 (Republic Act No.
                    10173). <span className="text-accent">*</span>
                  </span>
                </label>
                {privacyError ? (
                  <p className="registration-field-error mt-2 mb-0" role="alert">
                    Please consent to data privacy processing to continue.
                  </p>
                ) : null}

                <div className="registration-privacy-gate-actions">
                  <button
                    type="button"
                    className="registration-form-footer-btn registration-form-footer-btn--ghost"
                    onClick={handleClose}
                    disabled={isTransitioning}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="registration-form-footer-btn registration-form-footer-btn--primary"
                    onClick={handlePrivacyContinue}
                    disabled={isTransitioning}
                  >
                    Agree &amp; Continue
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {privacyAccepted ? (
          <RegistrationSidebar
            eventId={eventId}
            paymentBreakdown={paymentBreakdown}
          />
        ) : null}
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
