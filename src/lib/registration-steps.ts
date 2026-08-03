export const REGISTRATION_STEPS = [
  "Personal",
  "Professional",
  "Address",
  "Payment",
  "Review",
] as const;

export type RegistrationStepLabel = (typeof REGISTRATION_STEPS)[number];

export type RegistrationStepStatus = "pending" | "active" | "complete" | "error";

export type RegistrationStepState = {
  label: RegistrationStepLabel;
  status: RegistrationStepStatus;
};

/** Details form vs payment (QR + receipt) phase of the registration modal. */
export type RegistrationFormPhase = "details" | "payment";
