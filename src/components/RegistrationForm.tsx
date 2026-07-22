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
  getPhoneValidationError,
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
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { PnaSelect } from "@/components/ui/PnaSelect";

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


export function RegistrationForm({
  onCompleted,
  onBack,
  className = "",
  eventId = null,
}: {
  onCompleted?: () => void;
  onBack?: () => void;
  className?: string;
  eventId?: string | null;
} = {}) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | "receipt", string>>>({});
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
        phone: draft.phone,
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
      setDraftRestored(true);
    } else {
      setFormData(initialFormData);
      setDraftRestored(false);
    }

    setReceiptFile(null);
    setErrors({});
    setSubmitError("");
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

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormData | "receipt", string>> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";

    const emailError = getEmailValidationError(formData.email);
    if (emailError) newErrors.email = emailError;

    const phoneError = getPhoneValidationError(formData.phone);
    if (phoneError) newErrors.phone = phoneError;

    if (!formData.organization.trim()) newErrors.organization = "Organization is required";
    if (!formData.position.trim()) newErrors.position = "Position/title is required";
    if (!formData.category) newErrors.category = "Please select a registration category";
    if (!formData.feeTier) newErrors.feeTier = "Please choose your payment amount";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (!formData.city.trim()) newErrors.city = "City is required";
    if (!formData.province.trim()) newErrors.province = "Province is required";
    if (!formData.agreeToTerms) newErrors.agreeToTerms = "You must agree to the terms and conditions";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

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
          const registration = await registrationMutation.mutateAsync({
            ...formData,
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
            phone: formData.phone,
            organization: formData.organization,
            position: formData.position,
            category: conference.registration.fees[registration.category].label,
            receiptUploaded: uploaded,
          };

          setSuccessDetails(details);
          setShowSuccessModal(true);
          clearRegistrationDraft(eventId);
          setFormData(initialFormData);
          setDraftRestored(false);
          setReceiptFile(null);
          setErrors({});
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
  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (registrationMutation.isError) {
      registrationMutation.reset();
    }
  }

  return (
    <>
      <RegistrationSuccessModal
        open={showSuccessModal}
        onClose={handleCloseSuccessModal}
        details={successDetails}
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

        {draftRestored && (
          <p className="registration-form-draft-notice mb-0" role="status">
            Your previous entries have been restored so you can continue where you left off.
          </p>
        )}
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
            onChange={(v) => updateField("lastName", v)}
            error={errors.lastName}
          />
          <FormField
            label="First Name"
            id="firstName"
            required
            value={formData.firstName}
            onChange={(v) => updateField("firstName", v)}
            error={errors.firstName}
          />
          <FormField
            label="Middle Initial (M.I.)"
            id="middleInitial"
            value={formData.middleInitial ?? ""}
            onChange={(v) => updateField("middleInitial", v.toUpperCase().slice(0, 1))}
            error={errors.middleInitial}
            placeholder="A"
          />
          <FormField
            label="Email Address"
            id="email"
            type="email"
            required
            value={formData.email}
            onChange={(v) => updateField("email", v)}
            error={errors.email}
          />
          <FormField
            label="Phone Number"
            id="phone"
            type="tel"
            required
            placeholder="+63 9XX XXX XXXX"
            value={formData.phone}
            onChange={(v) => updateField("phone", v)}
            error={errors.phone}
          />
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
            error={errors.organization}
            className="col-12"
          />
          <FormField
            label="Position / Title"
            id="position"
            required
            value={formData.position}
            onChange={(v) => updateField("position", v)}
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
          <FormField
            label="Street Address"
            id="address"
            required
            value={formData.address}
            onChange={(v) => updateField("address", v)}
            error={errors.address}
            className="col-12"
          />
          <FormField
            label="City / Municipality"
            id="city"
            required
            value={formData.city}
            onChange={(v) => updateField("city", v)}
            error={errors.city}
          />
          <FormField
            label="Province"
            id="province"
            required
            value={formData.province}
            onChange={(v) => updateField("province", v)}
            error={errors.province}
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

      <fieldset className="registration-form-section">
        <legend className="registration-form-legend">
          <ReceiptSectionIcon />
          Proof of Payment
        </legend>
        <p className="registration-form-help mb-3">
          Pay using the Accepted QR or Bank Transfer option in the sidebar, then upload your receipt
          or screenshot here. You may also submit proof later using your reference number.
        </p>
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

      <div className="registration-form-footer">
        <button type="button" className="registration-form-footer-btn registration-form-footer-btn--ghost" onClick={onBack}>
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
        <button
          type="submit"
          disabled={loading || registrationMutation.isPending}
          className="registration-form-footer-btn registration-form-footer-btn--primary"
        >
          {loading || registrationMutation.isPending ? "Processing..." : "Continue"}
          <span aria-hidden="true">→</span>
        </button>
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
  error,
  placeholder,
  className = "col-12 col-md-6",
}: {
  label: string;
  id: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
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
        placeholder={placeholder}
        className={`input-dark ${error ? "input-dark-error" : ""}`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
