"use client";

import type { RegistrationStepState, RegistrationStepStatus } from "@/lib/registration-steps";

export function RegistrationStepper({ steps }: { steps: RegistrationStepState[] }) {
  return (
    <div className="registration-modal-stepper" aria-label="Registration progress">
      {steps.map((step, index) => (
        <div
          key={step.label}
          className={`registration-modal-step is-${step.status}`}
          aria-current={step.status === "active" ? "step" : undefined}
        >
          <span className={`registration-modal-step-index is-${step.status}`} aria-hidden="true">
            <StepIcon status={step.status} number={index + 1} />
          </span>
          <span className="registration-modal-step-label">{step.label}</span>
          <span className="registration-modal-step-sr">
            {step.label}: {statusLabel(step.status)}
          </span>
        </div>
      ))}
    </div>
  );
}

function statusLabel(status: RegistrationStepStatus): string {
  switch (status) {
    case "complete":
      return "complete";
    case "error":
      return "has errors";
    case "active":
      return "in progress";
    default:
      return "not started";
  }
}

function StepIcon({ status, number }: { status: RegistrationStepStatus; number: number }) {
  if (status === "complete") {
    return (
      <svg className="registration-modal-step-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === "error") {
    return (
      <svg className="registration-modal-step-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 7l10 10M17 7L7 17"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return <span>{number}</span>;
}
