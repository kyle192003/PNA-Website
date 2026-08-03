"use client";

import { useEffect, useState, type FormEvent } from "react";
import { conference, type RegistrationCategory } from "@/lib/conference";
import {
  formatPeso,
  resolveFeeTier,
  resolvePaymentAmount,
} from "@/lib/registration-fees";
import type { FeeTier } from "@/lib/types/admin";
import {
  getEmailValidationError,
  getNameLengthError,
  getRegistrationPhoneValidationError,
  NAME_LIMITS,
  toPhMobileInternational,
  toPhMobileLocalDigits,
} from "@/lib/form-validation";
import {
  clearRegistrationDraft,
  loadRegistrationDraft,
  saveRegistrationDraft,
} from "@/lib/registration-draft";
import { useSubmitRegistration, type RegistrationInput } from "@/hooks/use-registrations";
import { submitReceipt } from "@/lib/api/registrations";
import {
  RegistrationSuccessModal,
  type RegistrationSuccessDetails,
} from "@/components/RegistrationSuccessModal";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { SuccessDialog } from "@/components/ui/SuccessDialog";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { PnaSelect } from "@/components/ui/PnaSelect";
import { PhLocationSuggest } from "@/components/PhLocationSuggest";
import { RegistrationPaymentQr } from "@/components/RegistrationPaymentQr";
import type { PhPlaceSuggestion } from "@/lib/ph-locations";
import {
  REGISTRATION_STEPS,
  type RegistrationFormPhase,
  type RegistrationStepState,
  type RegistrationStepStatus,
} from "@/lib/registration-steps";

interface FormData extends RegistrationInput {
  category: RegistrationCategory | "";
  feeTier: FeeTier | "";
}

const initialFormData: FormData = {
  firstName: "",
  lastName: "",
  middleInitial: "",
  email: "",
  phone: "",
  organization: "",
  position: "",
  category: "",
  feeTier: "",
  address: "",
  city: "",
  province: "",
  dietaryRequirements: "",
  specialNeeds: "",
  agreeToTerms: false,
};

type FormFieldKey = keyof FormData;

function getFieldError(field: FormFieldKey, data: FormData): string | undefined {
  switch (field) {
    case "lastName":
      return getNameLengthError(data.lastName, "lastName", "Surname") ?? undefined;
    case "firstName":
      return getNameLengthError(data.firstName, "firstName", "First name") ?? undefined;
    case "email":
      return getEmailValidationError(data.email) ?? undefined;
    case "phone":
      return getRegistrationPhoneValidationError(data.phone) ?? undefined;
    case "organization":
      return data.organization.trim() ? undefined : "Organization is required";
    case "position":
      return data.position.trim() ? undefined : "Position/title is required";
    case "category":
      return data.category ? undefined : "Please select a registration category";
    case "feeTier":
      return data.feeTier ? undefined : "Please choose your payment amount";
    case "address":
      return data.address.trim() ? undefined : "Address is required";
    case "city":
      return data.city.trim() ? undefined : "City is required";
    case "province":
      return data.province.trim() ? undefined : "Province is required";
    case "agreeToTerms":
      return data.agreeToTerms ? undefined : "You must agree to the terms and conditions";
    default:
      return undefined;
  }
}

const LIVE_VALIDATE_FIELDS: FormFieldKey[] = [
  "lastName",
  "firstName",
  "email",
  "phone",
  "organization",
  "position",
  "category",
  "feeTier",
  "address",
  "city",
  "province",
  "agreeToTerms",
];

const DETAILS_VALIDATE_FIELDS: FormFieldKey[] = [
  "lastName",
  "firstName",
  "email",
  "phone",
  "organization",
  "position",
  "category",
  "feeTier",
  "address",
  "city",
  "province",
];

const SECTION_FIELDS: Record<(typeof REGISTRATION_STEPS)[number], FormFieldKey[]> = {
  Personal: ["lastName", "firstName", "email", "phone"],
  Professional: ["organization", "position", "category", "feeTier"],
  Address: ["address", "city", "province"],
  Payment: [],
  Review: ["agreeToTerms"],
};

function getSectionStatus(
  label: (typeof REGISTRATION_STEPS)[number],
  data: FormData,
  touched: Partial<Record<FormFieldKey, boolean>>,
  receiptFile: File | null,
  hasReceiptError: boolean,
  phase: RegistrationFormPhase
): RegistrationStepStatus {
  if (label === "Payment") {
    if (phase === "details") return "pending";
    if (hasReceiptError) return "error";
    if (receiptFile) return "complete";
    return "active";
  }

  if (label === "Review") {
    if (phase === "details") return "pending";
    if (data.agreeToTerms) return "complete";
    if (touched.agreeToTerms && getFieldError("agreeToTerms", data)) return "error";
    return receiptFile ? "active" : "pending";
  }

  const fields = SECTION_FIELDS[label];
  const fieldErrors = fields.map((field) => getFieldError(field, data));
  const hasError = fieldErrors.some(Boolean);
  const isComplete = fieldErrors.every((error) => !error);
  const anyTouched = fields.some((field) => touched[field]);

  if (phase === "payment" && isComplete) return "complete";
  if (isComplete) return "complete";
  if (anyTouched && hasError) return "error";
  return "pending";
}

function buildStepStates(
  data: FormData,
  touched: Partial<Record<FormFieldKey, boolean>>,
  receiptFile: File | null,
  hasReceiptError: boolean,
  phase: RegistrationFormPhase
): RegistrationStepState[] {
  const raw = REGISTRATION_STEPS.map((label) => ({
    label,
    status: getSectionStatus(label, data, touched, receiptFile, hasReceiptError, phase),
  }));

  let activeAssigned = false;
  return raw.map((step) => {
    if (step.status === "complete" || step.status === "error" || step.status === "active") {
      return step;
    }
    if (!activeAssigned) {
      activeAssigned = true;
      return { ...step, status: "active" as const };
    }
    return step;
  });
}


export function RegistrationForm({
  onCompleted,
  onBack,
  onStepStatesChange,
  className = "",
  eventId = null,
}: {
  onCompleted?: () => void;
  onBack?: () => void;
  onStepStatesChange?: (steps: RegistrationStepState[]) => void;
  className?: string;
  eventId?: string | null;
} = {}) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [showDraftRestored, setShowDraftRestored] = useState(false);
  const [formPhase, setFormPhase] = useState<RegistrationFormPhase>("details");
  const [errors, setErrors] = useState<Partial<Record<FormFieldKey | "receipt", string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FormFieldKey, boolean>>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [successDetails, setSuccessDetails] = useState<RegistrationSuccessDetails | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  const registrationMutation = useSubmitRegistration();

  useEffect(() => {
    const draft = loadRegistrationDraft(eventId);
    if (draft) {
      setFormData({
        firstName: draft.firstName,
        lastName: draft.lastName,
        middleInitial: draft.middleInitial,
        email: draft.email,
        phone: toPhMobileLocalDigits(draft.phone),
        organization: draft.organization,
        position: draft.position,
        category: draft.category,
        feeTier: draft.feeTier || "",
        address: draft.address,
        city: draft.city,
        province: draft.province,
        dietaryRequirements: draft.dietaryRequirements,
        specialNeeds: draft.specialNeeds,
        agreeToTerms: draft.agreeToTerms,
      });
      setShowDraftRestored(true);
    } else {
      setFormData(initialFormData);
      setShowDraftRestored(false);
    }

    setReceiptFile(null);
    setErrors({});
    setTouched({});
    setSubmitError("");
    setFormPhase("details");
    registrationMutation.reset();
    setDraftLoaded(true);
  }, [eventId]);

  useEffect(() => {
    if (!draftLoaded) return;

    const timeout = window.setTimeout(() => {
      saveRegistrationDraft(eventId, formData);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [draftLoaded, eventId, formData]);

  useEffect(() => {
    if (!draftLoaded) return;

    const timeout = window.setTimeout(() => {
      setErrors((prev) => {
        const next: Partial<Record<FormFieldKey | "receipt", string>> = { ...prev };

        for (const field of LIVE_VALIDATE_FIELDS) {
          if (!touched[field]) continue;
          const error = getFieldError(field, formData);
          if (error) next[field] = error;
          else delete next[field];
        }

        return next;
      });
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [draftLoaded, formData, touched]);

  useEffect(() => {
    if (!onStepStatesChange) return;
    onStepStatesChange(
      buildStepStates(formData, touched, receiptFile, Boolean(errors.receipt), formPhase)
    );
  }, [formData, touched, receiptFile, errors.receipt, formPhase, onStepStatesChange]);

  function validateDetails(): boolean {
    const newErrors: Partial<Record<FormFieldKey | "receipt", string>> = {};
    const allTouched: Partial<Record<FormFieldKey, boolean>> = { ...touched };

    for (const field of DETAILS_VALIDATE_FIELDS) {
      allTouched[field] = true;
      const error = getFieldError(field, formData);
      if (error) newErrors[field] = error;
    }

    setTouched(allTouched);
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of DETAILS_VALIDATE_FIELDS) {
        if (newErrors[field]) next[field] = newErrors[field];
        else delete next[field];
      }
      return next;
    });
    return Object.keys(newErrors).length === 0;
  }

  function validate(): boolean {
    const newErrors: Partial<Record<FormFieldKey | "receipt", string>> = {};
    const allTouched: Partial<Record<FormFieldKey, boolean>> = { ...touched };

    for (const field of LIVE_VALIDATE_FIELDS) {
      allTouched[field] = true;
      const error = getFieldError(field, formData);
      if (error) newErrors[field] = error;
    }

    setTouched(allTouched);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleContinueToPayment() {
    if (!validateDetails()) return;
    setSubmitError("");
    setFormPhase("payment");
    window.requestAnimationFrame(() => {
      document.getElementById("registration-form")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function handleBackFromPayment() {
    setSubmitError("");
    setFormPhase("details");
    window.requestAnimationFrame(() => {
      document.getElementById("registration-form")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (formPhase !== "payment") {
      handleContinueToPayment();
      return;
    }

    if (!validate()) return;

    setSubmitError("");

    requestConfirm({
      title: "Submit registration?",
      message:
        "Are you sure you want to submit your official registration? Please confirm your details are correct before continuing.",
      confirmLabel: "Submit registration",
      loadingMessage: receiptFile
        ? "Submitting registration and uploading receipt..."
        : "Submitting registration...",
      showSuccess: false,
      action: async () => {
        try {
          const phone = toPhMobileInternational(formData.phone);
          if (!phone) {
            setSubmitError("Enter a valid mobile number starting with 9 (e.g. 9606207919).");
            return;
          }

          const registration = await registrationMutation.mutateAsync({
            ...formData,
            phone,
            eventId,
          });

          let uploaded = false;
          if (receiptFile) {
            await submitReceipt(registration.referenceNumber, receiptFile);
            uploaded = true;
          }

          const details: RegistrationSuccessDetails = {
            referenceNumber: registration.referenceNumber,
            firstName: registration.firstName,
            lastName: registration.lastName,
            middleInitial: registration.middleInitial,
            email: registration.email,
            phone,
            organization: formData.organization,
            position: formData.position,
            category: conference.registration.fees[registration.category].label,
            receiptUploaded: uploaded,
          };

          setSuccessDetails(details);
          setShowSuccessModal(true);
          clearRegistrationDraft(eventId);
          setFormData(initialFormData);
          setShowDraftRestored(false);
          setReceiptFile(null);
          setErrors({});
          setFormPhase("details");
        } catch (error) {
          setSubmitError(error instanceof Error ? error.message : "Registration failed.");
          throw error;
        }
      },
    });
  }

  function handleCloseSuccessModal() {
    setShowSuccessModal(false);
    setSuccessDetails(null);
    onCompleted?.();
  }
  function updateField<K extends FormFieldKey>(field: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (registrationMutation.isError) {
      registrationMutation.reset();
    }
  }

  function markFieldTouched(field: FormFieldKey) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    setErrors((prev) => {
      const error = getFieldError(field, formData);
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  const isPaymentPhase = formPhase === "payment";

  return (
    <>
      <RegistrationSuccessModal
        open={showSuccessModal}
        onClose={handleCloseSuccessModal}
        details={successDetails}
      />

      <SuccessDialog
        open={showDraftRestored}
        title="Draft restored"
        message="Your previous entries have been restored so you can continue where you left off."
        closeLabel="Continue"
        onClose={() => setShowDraftRestored(false)}
      />

      <div className="registration-form-wrap">
        <LoadingOverlay show={loading} scope="local" variant="form" />
        <ActionConfirmDialogs hook={confirmHook} />

        <form
          id="registration-form"
          onSubmit={handleSubmit}
          className={`registration-form ${className}`.trim()}
          noValidate
        >
        {(registrationMutation.isError || submitError) && (
          <div className="registration-form-alert rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
            {submitError || registrationMutation.error?.message}
          </div>
        )}

      {!isPaymentPhase ? (
        <>
      <fieldset className="registration-form-section">
        <legend className="registration-form-legend">
          <UserSectionIcon />
          Personal Information
        </legend>
        <div className="row g-3">
          <FormField
            label="Surname"
            id="lastName"
            required
            value={formData.lastName}
            onChange={(v) => updateField("lastName", v.slice(0, NAME_LIMITS.lastName))}
            onBlur={() => markFieldTouched("lastName")}
            error={errors.lastName}
            maxLength={NAME_LIMITS.lastName}
            placeholder="Dela Cruz"
          />
          <FormField
            label="First Name"
            id="firstName"
            required
            value={formData.firstName}
            onChange={(v) => updateField("firstName", v.slice(0, NAME_LIMITS.firstName))}
            onBlur={() => markFieldTouched("firstName")}
            error={errors.firstName}
            maxLength={NAME_LIMITS.firstName}
            placeholder="Juan"
          />
          <FormField
            label="Middle Initial (M.I.)"
            id="middleInitial"
            value={formData.middleInitial ?? ""}
            onChange={(v) => updateField("middleInitial", v.toUpperCase().slice(0, 1))}
            error={errors.middleInitial}
            placeholder="A"
            maxLength={1}
          />
          <FormField
            label="Email Address"
            id="email"
            type="email"
            required
            value={formData.email}
            onChange={(v) => updateField("email", v)}
            onBlur={() => markFieldTouched("email")}
            error={errors.email}
            placeholder="juandelacruz@gmail.com"
          />
          <div className="col-12 col-md-6">
            <label htmlFor="phone" className="form-label registration-form-label">
              Phone Number <span className="text-accent">*</span>
            </label>
            <div className={`registration-phone-field${errors.phone ? " is-error" : ""}`}>
              <span className="registration-phone-prefix" aria-hidden="true">
                +63
              </span>
              <input
                type="tel"
                id="phone"
                inputMode="numeric"
                autoComplete="tel-national"
                value={toPhMobileLocalDigits(formData.phone)}
                onChange={(e) => updateField("phone", toPhMobileLocalDigits(e.target.value))}
                onBlur={() => markFieldTouched("phone")}
                placeholder="9606207919"
                maxLength={10}
                className={`input-dark registration-phone-input${errors.phone ? " input-dark-error" : ""}`}
              />
            </div>
            <p className="registration-phone-hint mb-0">
              Enter 10 digits starting with 9 (do not include 0).
            </p>
            {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
          </div>
        </div>
      </fieldset>

      <fieldset className="registration-form-section">
        <legend className="registration-form-legend">
          <BriefcaseSectionIcon />
          Professional Details
        </legend>
        <div className="row g-3">
          <FormField
            label="Organization / Agency"
            id="organization"
            required
            value={formData.organization}
            onChange={(v) => updateField("organization", v)}
            onBlur={() => markFieldTouched("organization")}
            error={errors.organization}
            className="col-12"
          />
          <FormField
            label="Position / Title"
            id="position"
            required
            value={formData.position}
            onChange={(v) => updateField("position", v)}
            onBlur={() => markFieldTouched("position")}
            error={errors.position}
          />
          <div className="col-12 col-md-6">
            <label htmlFor="category" className="form-label registration-form-label">
              Registration Category <span className="text-accent">*</span>
            </label>
            <PnaSelect
              id="category"
              value={formData.category}
              onChange={(next) => {
                const category = next as RegistrationCategory | "";
                updateField("category", category);
                if (category && !formData.feeTier) {
                  updateField("feeTier", resolveFeeTier(null));
                }
              }}
              className={errors.category ? "pna-select--error" : ""}
              placeholder="Select a category"
              required
              options={[
                { value: "", label: "Select a category" },
                ...Object.entries(conference.registration.fees).map(([key, fee]) => ({
                  value: key,
                  label: fee.label,
                })),
              ]}
            />
            {errors.category && <p className="mt-1 text-xs text-red-400">{errors.category}</p>}
          </div>

          {formData.category ? (
            <div className="col-12">
              <p className="form-label registration-form-label mb-2">
                Choose payment amount <span className="text-accent">*</span>
              </p>
              <div className="registration-fee-choice-grid">
                {(["early", "regular"] as const).map((tier) => {
                  const amount = resolvePaymentAmount(
                    formData.category as RegistrationCategory,
                    tier,
                    null
                  );
                  const selected = formData.feeTier === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      className={`registration-fee-choice${selected ? " is-selected" : ""}`}
                      onClick={() => updateField("feeTier", tier)}
                    >
                      <span className="registration-fee-choice-tier">
                        {tier === "early" ? "Early bird" : "Regular"}
                      </span>
                      <span className="registration-fee-choice-amount">{formatPeso(amount)}</span>
                      <span className="registration-fee-choice-meta">
                        {conference.registration.fees[formData.category as RegistrationCategory].label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.feeTier && <p className="mt-1 text-xs text-red-400">{errors.feeTier}</p>}
            </div>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="registration-form-section">
        <legend className="registration-form-legend">
          <HomeSectionIcon />
          Address
        </legend>
        <div className="row g-3">
          <PhLocationSuggest
            label="Street Address"
            id="address"
            type="street"
            required
            value={formData.address}
            onChange={(v) => updateField("address", v)}
            onBlur={() => markFieldTouched("address")}
            onSelect={(suggestion: PhPlaceSuggestion) => {
              updateField("address", suggestion.street || suggestion.label);
              if (suggestion.city) updateField("city", suggestion.city);
              if (suggestion.province) updateField("province", suggestion.province);
            }}
            error={errors.address}
            placeholder="Start typing a street or barangay"
            className="col-12"
          />
          <PhLocationSuggest
            label="City / Municipality"
            id="city"
            type="city"
            required
            value={formData.city}
            onChange={(v) => updateField("city", v)}
            onBlur={() => markFieldTouched("city")}
            onSelect={(suggestion: PhPlaceSuggestion) => {
              updateField("city", suggestion.city || suggestion.label);
              if (suggestion.province) updateField("province", suggestion.province);
            }}
            error={errors.city}
            placeholder="Start typing a city or municipality"
          />
          <PhLocationSuggest
            label="Province"
            id="province"
            type="province"
            required
            value={formData.province}
            onChange={(v) => updateField("province", v)}
            onBlur={() => markFieldTouched("province")}
            onSelect={(suggestion: PhPlaceSuggestion) => {
              updateField("province", suggestion.province || suggestion.label);
            }}
            error={errors.province}
            placeholder="Start typing a province"
          />
        </div>
      </fieldset>

      <fieldset className="registration-form-section">
        <legend>
          Additional Information <span className="registration-form-optional">(Optional)</span>
        </legend>
        <div className="row g-3">
          <FormField
            label="Dietary Requirements"
            id="dietaryRequirements"
            value={formData.dietaryRequirements}
            onChange={(v) => updateField("dietaryRequirements", v)}
            placeholder="e.g., Vegetarian, Halal, None"
            className="col-12"
          />
          <div className="col-12">
            <label htmlFor="specialNeeds" className="form-label registration-form-label">
              Special Needs / Accessibility Requirements
            </label>
            <textarea
              id="specialNeeds"
              rows={3}
              value={formData.specialNeeds}
              onChange={(e) => updateField("specialNeeds", e.target.value)}
              placeholder="Please describe any accessibility needs"
              className="input-dark resize-none"
            />
          </div>
        </div>
      </fieldset>
        </>
      ) : (
        <>
      <fieldset className="registration-form-section">
        <legend className="registration-form-legend">
          <ReceiptSectionIcon />
          Proof of Payment
        </legend>
        <p className="registration-form-help mb-3">
          Pay using the QR code or bank transfer below, then upload your receipt or screenshot.
          You may also submit proof later using your reference number.
        </p>

        <div className="registration-form-payment-panel mb-4">
          <RegistrationPaymentQr variant="form" eventId={eventId} />
        </div>

        <div className="col-12">
          <label htmlFor="receipt" className="form-label registration-form-label">
            Upload Receipt <span className="registration-form-optional">(Image or PDF, max 5 MB)</span>
          </label>
          <input
            id="receipt"
            type="file"
            accept="image/*,application/pdf"
            className={`input-dark ${errors.receipt ? "input-dark-error" : ""}`}
            onChange={(e) => {
              setReceiptFile(e.target.files?.[0] ?? null);
              if (errors.receipt) {
                setErrors((prev) => ({ ...prev, receipt: undefined }));
              }
            }}
          />
          {receiptFile && (
            <p className="mt-2 mb-0 text-xs text-muted">Selected: {receiptFile.name}</p>
          )}
          {errors.receipt && <p className="mt-1 text-xs text-red-400">{errors.receipt}</p>}
        </div>
      </fieldset>

      <div className="registration-form-terms rounded-lg bg-white border border-green-100 p-3 p-md-4">
        <label className="d-flex align-items-start gap-3 mb-0 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.agreeToTerms}
            onChange={(e) => updateField("agreeToTerms", e.target.checked)}
            className="registration-form-checkbox mt-1"
          />
          <span className="small text-muted lh-base">
            I hereby confirm that the information provided is accurate and complete. I acknowledge the
            terms and conditions governing participation in the {conference.conferenceName}, including
            the requirement for payment confirmation prior to the event. I consent to the processing
            of my personal data in accordance with the Data Privacy Act of 2012 (Republic Act No.
            10173).
          </span>
        </label>
        {errors.agreeToTerms && (
          <p className="mt-2 mb-0 text-xs text-red-500 ps-4 ms-3">{errors.agreeToTerms}</p>
        )}
      </div>
        </>
      )}

      <div className="registration-form-footer">
        <button
          type="button"
          className="registration-form-footer-btn registration-form-footer-btn--ghost"
          onClick={isPaymentPhase ? handleBackFromPayment : onBack}
        >
          <span aria-hidden="true">←</span>
          Back
        </button>
        <button
          type="button"
          className="registration-form-footer-btn registration-form-footer-btn--outline"
          onClick={() => {
            saveRegistrationDraft(eventId, formData);
            setDraftSavedNotice(true);
            window.setTimeout(() => setDraftSavedNotice(false), 2500);
          }}
        >
          <BookmarkIcon />
          Save Draft
        </button>
        {isPaymentPhase ? (
          <button
            type="submit"
            disabled={loading || registrationMutation.isPending}
            className="registration-form-footer-btn registration-form-footer-btn--primary"
          >
            {loading || registrationMutation.isPending ? "Processing..." : "Submit registration"}
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button
            type="button"
            className="registration-form-footer-btn registration-form-footer-btn--primary"
            onClick={handleContinueToPayment}
          >
            Next
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
      {draftSavedNotice ? (
        <p className="registration-form-draft-saved" role="status">
          Draft saved.
        </p>
      ) : null}
        </form>
      </div>
    </>
  );
}

function UserSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6 19c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function BriefcaseSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function HomeSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function ReceiptSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4h10v16l-2-1.5L13 20l-2-1.5L9 20l-2-1.5L5 20V4Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4h10v16l-5-3-5 3V4Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function FormField({
  label,
  id,
  type = "text",
  required = false,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  maxLength,
  className = "col-12 col-md-6",
}: {
  label: string;
  id: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="form-label registration-form-label">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      <input
        type={type}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`input-dark ${error ? "input-dark-error" : ""}`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
