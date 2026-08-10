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
  createEmptyGroupMember,
  loadRegistrationDraft,
  saveRegistrationDraft,
  type GroupMemberDraft,
  type RegistrationMode,
} from "@/lib/registration-draft";
import {
  useSubmitGroupRegistration,
  useSubmitRegistration,
  type RegistrationInput,
} from "@/hooks/use-registrations";
import { submitReceipt } from "@/lib/api/registrations";
import {
  RegistrationSuccessModal,
  type RegistrationSuccessDetails,
} from "@/components/RegistrationSuccessModal";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { MessageDialog } from "@/components/ui/MessageDialog";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { PnaSelect } from "@/components/ui/PnaSelect";
import { PhLocationSuggest } from "@/components/PhLocationSuggest";
import { RegistrationPaymentQr } from "@/components/RegistrationPaymentQr";
import type { RegistrationPaymentBreakdown } from "@/components/RegistrationSidebar";
import type { PhPlaceSuggestion } from "@/lib/ph-locations";
import { MAX_GROUP_SIZE } from "@/lib/registrations-constants";
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
  onPaymentBreakdownChange,
  className = "",
  eventId = null,
}: {
  onCompleted?: () => void;
  onBack?: () => void;
  onStepStatesChange?: (steps: RegistrationStepState[]) => void;
  onPaymentBreakdownChange?: (breakdown: RegistrationPaymentBreakdown | null) => void;
  className?: string;
  eventId?: string | null;
} = {}) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("individual");
  const [members, setMembers] = useState<GroupMemberDraft[]>([]);
  const [memberErrors, setMemberErrors] = useState<
    Record<number, Partial<Record<keyof GroupMemberDraft, string>>>
  >({});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [showDraftRestored, setShowDraftRestored] = useState(false);
  const [formPhase, setFormPhase] = useState<RegistrationFormPhase>("details");
  const [errors, setErrors] = useState<
    Partial<Record<FormFieldKey | "receipt" | "paymentReference" | "members", string>>
  >({});
  const [touched, setTouched] = useState<Partial<Record<FormFieldKey, boolean>>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [ocrStatus, setOcrStatus] = useState<"idle" | "scanning" | "done" | "unavailable">("idle");
  const [ocrMessage, setOcrMessage] = useState("");
  const [referenceConfirmed, setReferenceConfirmed] = useState(false);
  const [successDetails, setSuccessDetails] = useState<RegistrationSuccessDetails | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  const registrationMutation = useSubmitRegistration();
  const groupRegistrationMutation = useSubmitGroupRegistration();
  const isSubmitting = registrationMutation.isPending || groupRegistrationMutation.isPending;

  const headcount = registrationMode === "group" ? 1 + members.length : 1;
  const unitFee =
    formData.category && formData.feeTier
      ? resolvePaymentAmount(
          formData.category as RegistrationCategory,
          formData.feeTier,
          null
        )
      : 0;
  const totalFee = unitFee * headcount;

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
      setRegistrationMode(draft.mode);
      setMembers(
        draft.mode === "group"
          ? draft.members.length > 0
            ? draft.members.map((m) => ({
                ...m,
                phone: toPhMobileLocalDigits(m.phone),
              }))
            : [createEmptyGroupMember()]
          : []
      );
      setShowDraftRestored(true);
    } else {
      setFormData(initialFormData);
      setRegistrationMode("individual");
      setMembers([]);
      setShowDraftRestored(false);
    }

    setReceiptFile(null);
    setErrors({});
    setMemberErrors({});
    setTouched({});
    setFormPhase("details");
    registrationMutation.reset();
    groupRegistrationMutation.reset();
    setDraftLoaded(true);
  }, [eventId]);

  useEffect(() => {
    if (!draftLoaded) return;

    const timeout = window.setTimeout(() => {
      saveRegistrationDraft(eventId, {
        ...formData,
        mode: registrationMode,
        members: registrationMode === "group" ? members : [],
      });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [draftLoaded, eventId, formData, registrationMode, members]);

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

  useEffect(() => {
    if (!onPaymentBreakdownChange) return;

    if (
      formPhase !== "payment" ||
      !formData.category ||
      !formData.feeTier ||
      !(formData.category in conference.registration.fees)
    ) {
      onPaymentBreakdownChange(null);
      return;
    }

    const category = formData.category as RegistrationCategory;
    onPaymentBreakdownChange({
      categoryLabel: conference.registration.fees[category].label,
      feeTierLabel: formData.feeTier === "regular" ? "Regular" : "Early Bird",
      unitFee,
      headcount,
      totalFee,
    });
  }, [
    formPhase,
    formData.category,
    formData.feeTier,
    unitFee,
    headcount,
    totalFee,
    onPaymentBreakdownChange,
  ]);

  function getMemberFieldError(
    member: GroupMemberDraft,
    field: keyof GroupMemberDraft
  ): string | undefined {
    switch (field) {
      case "lastName":
        return getNameLengthError(member.lastName, "lastName", "Surname") ?? undefined;
      case "firstName":
        return getNameLengthError(member.firstName, "firstName", "First name") ?? undefined;
      case "email":
        return getEmailValidationError(member.email) ?? undefined;
      case "phone":
        return getRegistrationPhoneValidationError(member.phone) ?? undefined;
      default:
        return undefined;
    }
  }

  function validateMembers(): boolean {
    if (registrationMode !== "group") {
      setMemberErrors({});
      setErrors((prev) => {
        const next = { ...prev };
        delete next.members;
        return next;
      });
      return true;
    }

    if (members.length < 1) {
      setErrors((prev) => ({
        ...prev,
        members: "Add at least one additional participant for group registration.",
      }));
      return false;
    }

    const nextMemberErrors: Record<number, Partial<Record<keyof GroupMemberDraft, string>>> = {};
    const emails = [formData.email.trim().toLowerCase()];
    let ok = true;

    members.forEach((member, index) => {
      const fieldErrors: Partial<Record<keyof GroupMemberDraft, string>> = {};
      for (const field of ["lastName", "firstName", "email", "phone"] as const) {
        const error = getMemberFieldError(member, field);
        if (error) {
          fieldErrors[field] = error;
          ok = false;
        }
      }
      const email = member.email.trim().toLowerCase();
      if (email && emails.includes(email)) {
        fieldErrors.email = "Each participant needs a unique email address.";
        ok = false;
      } else if (email) {
        emails.push(email);
      }
      if (Object.keys(fieldErrors).length > 0) {
        nextMemberErrors[index] = fieldErrors;
      }
    });

    setMemberErrors(nextMemberErrors);
    setErrors((prev) => {
      const next = { ...prev };
      if (ok) delete next.members;
      else if (!next.members) next.members = "Please fix the additional participant details.";
      return next;
    });
    return ok;
  }

  function validateDetails(): boolean {
    const newErrors: Partial<Record<FormFieldKey | "receipt" | "members", string>> = {};
    const allTouched: Partial<Record<FormFieldKey, boolean>> = { ...touched };

    for (const field of DETAILS_VALIDATE_FIELDS) {
      allTouched[field] = true;
      const error = getFieldError(field, formData);
      if (error) newErrors[field] = error;
    }

    setTouched(allTouched);
    const membersOk = validateMembers();
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of DETAILS_VALIDATE_FIELDS) {
        if (newErrors[field]) next[field] = newErrors[field];
        else delete next[field];
      }
      return next;
    });
    return Object.keys(newErrors).length === 0 && membersOk;
  }

  function validate(): boolean {
    const newErrors: Partial<
      Record<FormFieldKey | "receipt" | "paymentReference" | "members", string>
    > = {};
    const allTouched: Partial<Record<FormFieldKey, boolean>> = { ...touched };

    for (const field of LIVE_VALIDATE_FIELDS) {
      allTouched[field] = true;
      const error = getFieldError(field, formData);
      if (error) newErrors[field] = error;
    }

    if (!receiptFile) {
      newErrors.receipt = "Proof of payment is required before you can submit.";
    } else if (receiptFile.size > 5 * 1024 * 1024) {
      newErrors.receipt = "Receipt must be 5 MB or smaller.";
    }

    const trimmedRef = paymentReference.trim();
    if (!trimmedRef) {
      newErrors.paymentReference =
        "Enter the payment / transfer reference from your receipt.";
    } else if (trimmedRef.length < 4) {
      newErrors.paymentReference = "Payment reference looks too short. Please check your receipt.";
    } else if (!referenceConfirmed) {
      newErrors.paymentReference =
        "Please confirm the payment reference looks correct before submitting.";
    }

    setTouched(allTouched);
    const membersOk = validateMembers();
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && membersOk;
  }

  function handleContinueToPayment() {
    if (!validateDetails()) return;
    setFormPhase("payment");
    window.requestAnimationFrame(() => {
      document.getElementById("registration-form")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function handleBackFromPayment() {
    setFormPhase("details");
    window.requestAnimationFrame(() => {
      document.getElementById("registration-form")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  async function handleReceiptSelected(file: File | null) {
    setReceiptFile(file);
    setPaymentReference("");
    setReferenceConfirmed(false);
    setOcrMessage("");
    setOcrStatus("idle");
    setErrors((prev) => {
      const next = { ...prev };
      delete next.receipt;
      delete next.paymentReference;
      return next;
    });

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        receipt: "Receipt must be 5 MB or smaller.",
      }));
      setReceiptFile(null);
      return;
    }

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setOcrStatus("unavailable");
      setOcrMessage(
        "PDF uploaded. Please type the payment / transfer reference from your receipt below."
      );
      return;
    }

    if (!file.type.startsWith("image/")) {
      setOcrStatus("unavailable");
      setOcrMessage("Please type the payment / transfer reference from your receipt below.");
      return;
    }

    setOcrStatus("scanning");
    try {
      const { scanReceiptImage } = await import("@/lib/receipt-ocr");
      const result = await scanReceiptImage(file);
      setOcrStatus("done");
      if (result.best) {
        setPaymentReference(result.best);
        setReferenceConfirmed(false);
        setOcrMessage(
          "We found a payment reference on your receipt. Does this look right? Edit it if needed, then confirm below."
        );
      } else {
        setOcrMessage(
          "We could not find a clear payment reference. Please type it from your receipt, then confirm below."
        );
      }
    } catch {
      setOcrStatus("unavailable");
      setOcrMessage(
        "Could not scan this image. Please type the payment / transfer reference from your receipt below."
      );
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (formPhase !== "payment") {
      handleContinueToPayment();
      return;
    }

    if (!validate()) return;

    const isGroup = registrationMode === "group";
    requestConfirm({
      title: isGroup ? "Submit group registration?" : "Submit registration?",
      message: isGroup
        ? `Submit registration for ${headcount} participants? One payment of ${formatPeso(totalFee)} covers the group. Each person will receive their own confirmation email.`
        : "Are you sure you want to submit your official registration? Please confirm your details are correct before continuing.",
      confirmLabel: isGroup ? "Submit group registration" : "Submit registration",
      loadingMessage: "Submitting registration and uploading receipt...",
      errorTitle: "Registration could not be submitted",
      showSuccess: false,
      action: async () => {
        try {
          const phone = toPhMobileInternational(formData.phone);
          if (!phone) {
            throw new Error("Enter a valid mobile number starting with 9 (e.g. 9606207919).");
          }

          let details: RegistrationSuccessDetails;

          if (isGroup) {
            const normalizedMembers = members.map((member) => {
              const memberPhone = toPhMobileInternational(member.phone);
              if (!memberPhone) {
                throw new Error(
                  "Each participant needs a valid mobile number starting with 9."
                );
              }
              return {
                firstName: member.firstName,
                lastName: member.lastName,
                middleInitial: member.middleInitial,
                email: member.email,
                phone: memberPhone,
              };
            });

            const result = await groupRegistrationMutation.mutateAsync({
              primary: {
                ...formData,
                phone,
                eventId,
              },
              members: normalizedMembers,
              eventId,
            });

            let uploaded = false;
            let receiptUploadFailed = false;
            try {
              await submitReceipt(
                result.registration.referenceNumber,
                receiptFile!,
                formData.email,
                paymentReference.trim()
              );
              uploaded = true;
            } catch {
              receiptUploadFailed = true;
            }

            details = {
              referenceNumber: result.registration.referenceNumber,
              firstName: result.registration.firstName,
              lastName: result.registration.lastName,
              middleInitial: result.registration.middleInitial,
              email: result.registration.email,
              phone,
              organization: formData.organization,
              position: formData.position,
              category: conference.registration.fees[result.registration.category].label,
              receiptUploaded: uploaded,
              receiptUploadFailed,
              groupSize: result.group.groupSize ?? headcount,
              totalPaymentAmount: result.group.totalPaymentAmount,
              groupMembers: result.group.participants.map((p) => ({
                firstName: p.firstName,
                lastName: p.lastName,
                middleInitial: p.middleInitial,
                email: p.email,
                referenceNumber: p.referenceNumber,
              })),
            };
          } else {
            const registration = await registrationMutation.mutateAsync({
              ...formData,
              phone,
              eventId,
            });

            let uploaded = false;
            let receiptUploadFailed = false;
            try {
              await submitReceipt(
                registration.referenceNumber,
                receiptFile!,
                formData.email,
                paymentReference.trim()
              );
              uploaded = true;
            } catch {
              receiptUploadFailed = true;
            }

            details = {
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
              receiptUploadFailed,
            };
          }

          setSuccessDetails(details);
          setShowSuccessModal(true);
          clearRegistrationDraft(eventId);
          setFormData(initialFormData);
          setRegistrationMode("individual");
          setMembers([]);
          setShowDraftRestored(false);
          setReceiptFile(null);
          setPaymentReference("");
          setOcrStatus("idle");
          setOcrMessage("");
          setReferenceConfirmed(false);
          setErrors({});
          setMemberErrors({});
          setFormPhase("details");
        } catch (error) {
          throw error instanceof Error
            ? error
            : new Error("Registration failed. Please try again.");
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
    if (registrationMutation.isError) registrationMutation.reset();
    if (groupRegistrationMutation.isError) groupRegistrationMutation.reset();
  }

  function setMode(mode: RegistrationMode) {
    setRegistrationMode(mode);
    if (mode === "group" && members.length === 0) {
      setMembers([createEmptyGroupMember()]);
    }
    if (mode === "individual") {
      setMembers([]);
      setMemberErrors({});
      setErrors((prev) => {
        const next = { ...prev };
        delete next.members;
        return next;
      });
    }
  }

  function updateMember(index: number, field: keyof GroupMemberDraft, value: string) {
    setMembers((prev) =>
      prev.map((member, i) => {
        if (i !== index) return member;
        if (field === "middleInitial") {
          return { ...member, middleInitial: value.toUpperCase().slice(0, 1) };
        }
        if (field === "phone") {
          return { ...member, phone: toPhMobileLocalDigits(value) };
        }
        if (field === "firstName") {
          return { ...member, firstName: value.slice(0, NAME_LIMITS.firstName) };
        }
        if (field === "lastName") {
          return { ...member, lastName: value.slice(0, NAME_LIMITS.lastName) };
        }
        return { ...member, [field]: value };
      })
    );
  }

  function addMember() {
    if (1 + members.length >= MAX_GROUP_SIZE) return;
    setMembers((prev) => [...prev, createEmptyGroupMember()]);
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
    setMemberErrors((prev) => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([key, value]) => {
        const i = Number(key);
        if (i < index) next[i] = value;
        if (i > index) next[i - 1] = value;
      });
      return next;
    });
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

      <div className="registration-form-wrap">
        <LoadingOverlay show={loading} scope="local" variant="form" />
        <ActionConfirmDialogs hook={confirmHook} />
        <MessageDialog
          open={showDraftRestored}
          title="Draft restored"
          message="Your previous draft was restored. You can continue where you left off."
          variant="info"
          closeLabel="Continue"
          onClose={() => setShowDraftRestored(false)}
        />

        <form
          id="registration-form"
          onSubmit={handleSubmit}
          className={`registration-form ${className}`.trim()}
          noValidate
        >

      {!isPaymentPhase ? (
        <>
      <fieldset className="registration-form-section">
        <legend className="registration-form-legend">Registration type</legend>
        <p className="registration-form-help mb-3">
          Register yourself only, or register a group with one combined payment. Each group
          member still needs their own name, email, and phone so they receive a check-in QR by
          email.
        </p>
        <div className="registration-mode-toggle" role="group" aria-label="Registration type">
          <button
            type="button"
            className={`registration-mode-option${
              registrationMode === "individual" ? " is-selected" : ""
            }`}
            onClick={() => setMode("individual")}
          >
            Individual
          </button>
          <button
            type="button"
            className={`registration-mode-option${
              registrationMode === "group" ? " is-selected" : ""
            }`}
            onClick={() => setMode("group")}
          >
            Group
          </button>
        </div>
      </fieldset>

      <fieldset className="registration-form-section">
        <legend className="registration-form-legend">
          <UserSectionIcon />
          {registrationMode === "group" ? "Primary registrant" : "Personal Information"}
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

      {registrationMode === "group" ? (
        <fieldset className="registration-form-section">
          <legend className="registration-form-legend">
            <UsersSectionIcon />
            Additional participants
          </legend>
          <p className="registration-form-help mb-3">
            Enter each participant&apos;s name, email, and phone. Organization, category, and
            address from the primary registrant apply to everyone. Maximum {MAX_GROUP_SIZE}{" "}
            people including you.
          </p>
          {errors.members ? (
            <p className="mb-3 text-xs text-red-500">{errors.members}</p>
          ) : null}
          <div className="registration-group-members">
            {members.map((member, index) => (
              <div key={index} className="registration-group-member">
                <div className="registration-group-member-header">
                  <p className="registration-group-member-title mb-0">
                    Participant {index + 2}
                  </p>
                  {members.length > 1 ? (
                    <button
                      type="button"
                      className="registration-group-member-remove"
                      onClick={() => removeMember(index)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="row g-3">
                  <FormField
                    label="Surname"
                    id={`member-${index}-lastName`}
                    required
                    value={member.lastName}
                    onChange={(v) => updateMember(index, "lastName", v)}
                    error={memberErrors[index]?.lastName}
                    maxLength={NAME_LIMITS.lastName}
                    placeholder="Dela Cruz"
                  />
                  <FormField
                    label="First Name"
                    id={`member-${index}-firstName`}
                    required
                    value={member.firstName}
                    onChange={(v) => updateMember(index, "firstName", v)}
                    error={memberErrors[index]?.firstName}
                    maxLength={NAME_LIMITS.firstName}
                    placeholder="Juan"
                  />
                  <FormField
                    label="Middle Initial (M.I.)"
                    id={`member-${index}-middleInitial`}
                    value={member.middleInitial}
                    onChange={(v) => updateMember(index, "middleInitial", v)}
                    placeholder="A"
                    maxLength={1}
                  />
                  <FormField
                    label="Email Address"
                    id={`member-${index}-email`}
                    type="email"
                    required
                    value={member.email}
                    onChange={(v) => updateMember(index, "email", v)}
                    error={memberErrors[index]?.email}
                    placeholder="juandelacruz@gmail.com"
                  />
                  <div className="col-12 col-md-6">
                    <label
                      htmlFor={`member-${index}-phone`}
                      className="form-label registration-form-label"
                    >
                      Phone Number <span className="text-accent">*</span>
                    </label>
                    <div
                      className={`registration-phone-field${
                        memberErrors[index]?.phone ? " is-error" : ""
                      }`}
                    >
                      <span className="registration-phone-prefix" aria-hidden="true">
                        +63
                      </span>
                      <input
                        type="tel"
                        id={`member-${index}-phone`}
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={toPhMobileLocalDigits(member.phone)}
                        onChange={(e) => updateMember(index, "phone", e.target.value)}
                        placeholder="9606207919"
                        maxLength={10}
                        className={`input-dark registration-phone-input${
                          memberErrors[index]?.phone ? " input-dark-error" : ""
                        }`}
                      />
                    </div>
                    {memberErrors[index]?.phone ? (
                      <p className="mt-1 text-xs text-red-400">{memberErrors[index]?.phone}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {1 + members.length < MAX_GROUP_SIZE ? (
            <button
              type="button"
              className="registration-group-add-btn mt-3"
              onClick={addMember}
            >
              + Add participant
            </button>
          ) : (
            <p className="mt-3 mb-0 text-xs text-muted">
              Maximum of {MAX_GROUP_SIZE} participants reached.
            </p>
          )}
        </fieldset>
      ) : null}

      <fieldset className="registration-form-section">
        <legend className="registration-form-legend">
          <BriefcaseSectionIcon />
          Professional Details
        </legend>
        {registrationMode === "group" ? (
          <p className="registration-form-help mb-3">
            Category and fee apply to every participant in the group.
          </p>
        ) : null}
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
          Proof of payment is required to complete registration.
          {registrationMode === "group"
            ? " One payment and one receipt cover the whole group."
            : ""}{" "}
          Registration payments are subject to applicable Philippine tax documentation,
          including BIR Form 2303 (Certificate of Registration) and BIR Form 2307
          (Certificate of Creditable Tax Withheld at Source).
        </p>

        {formData.category && formData.feeTier ? (
          <div className="registration-group-total mb-4">
            <div className="registration-group-total-row">
              <span>Category</span>
              <strong>
                {conference.registration.fees[formData.category as RegistrationCategory].label}
              </strong>
            </div>
            <div className="registration-group-total-row">
              <span>Rate</span>
              <strong>{formData.feeTier === "regular" ? "Regular" : "Early Bird"}</strong>
            </div>
            <div className="registration-group-total-row">
              <span>Fee per person</span>
              <strong>{formatPeso(unitFee)}</strong>
            </div>
            {registrationMode === "group" ? (
              <div className="registration-group-total-row">
                <span>Participants</span>
                <strong>{headcount}</strong>
              </div>
            ) : null}
            <div className="registration-group-total-row is-total">
              <span>Total due</span>
              <strong>{formatPeso(totalFee)}</strong>
            </div>
          </div>
        ) : null}

        <div className="registration-form-payment-panel mb-4">
          <RegistrationPaymentQr variant="form" eventId={eventId} />
        </div>

        <div className="col-12">
          <label htmlFor="receipt" className="form-label registration-form-label">
            Upload Proof of Payment <span className="text-accent">*</span>
            <span className="registration-form-optional"> (Image or PDF, max 5 MB)</span>
          </label>
          <input
            id="receipt"
            type="file"
            accept="image/*,application/pdf"
            className={`input-dark ${errors.receipt ? "input-dark-error" : ""}`}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void handleReceiptSelected(file);
            }}
          />
          {receiptFile && (
            <p className="mt-2 mb-0 text-xs text-muted">Selected: {receiptFile.name}</p>
          )}
          {ocrStatus === "scanning" ? (
            <p className="mt-2 mb-0 text-xs text-muted" role="status">
              Scanning receipt for payment reference…
            </p>
          ) : null}
          {ocrMessage ? (
            <p className="mt-2 mb-0 text-xs text-muted" role="status">
              {ocrMessage}
            </p>
          ) : null}
          {errors.receipt && <p className="mt-1 text-xs text-red-400">{errors.receipt}</p>}
        </div>

        {receiptFile ? (
          <div className="col-12 mt-3 registration-payment-reference-panel">
            <label htmlFor="paymentReference" className="form-label registration-form-label">
              Payment / transfer reference <span className="text-accent">*</span>
            </label>
            <p className="registration-form-help mb-2">
              We try to read this from your receipt. Please check it carefully and correct it if
              needed.
            </p>
            <input
              id="paymentReference"
              type="text"
              value={paymentReference}
              onChange={(e) => {
                setPaymentReference(e.target.value);
                setReferenceConfirmed(false);
                if (errors.paymentReference) {
                  setErrors((prev) => ({ ...prev, paymentReference: undefined }));
                }
              }}
              placeholder="e.g. GCash Ref No. or bank transfer reference"
              className={`input-dark ${errors.paymentReference ? "input-dark-error" : ""}`}
              autoComplete="off"
            />
            <label className="d-flex align-items-start gap-2 mt-3 mb-0 cursor-pointer">
              <input
                type="checkbox"
                className="registration-form-checkbox mt-1"
                checked={referenceConfirmed}
                onChange={(e) => {
                  setReferenceConfirmed(e.target.checked);
                  if (e.target.checked && errors.paymentReference) {
                    setErrors((prev) => ({ ...prev, paymentReference: undefined }));
                  }
                }}
              />
              <span className="small text-muted lh-base">
                Yes, this payment reference looks right (or I corrected it to match my receipt).
              </span>
            </label>
            {errors.paymentReference && (
              <p className="mt-1 text-xs text-red-400">{errors.paymentReference}</p>
            )}
          </div>
        ) : null}
      </fieldset>

      <div className="registration-form-terms rounded-lg bg-white border border-green-100 p-3 p-md-4">
        <label className="d-flex align-items-start gap-3 mb-0 cursor-pointer">
          <input
            id="agreeToTerms"
            name="agreeToTerms"
            type="checkbox"
            checked={formData.agreeToTerms}
            onChange={(e) => updateField("agreeToTerms", e.target.checked)}
            className="registration-form-checkbox mt-1"
          />
          <span className="small text-muted lh-base">
            I hereby confirm that the information provided is accurate and complete. I acknowledge the
            terms and conditions governing participation in the {conference.conferenceName}, including
            the requirement for payment confirmation prior to the event, and compliance with applicable
            Philippine tax documentation such as BIR Form 2303 (Certificate of Registration) and BIR
            Form 2307 (Certificate of Creditable Tax Withheld at Source), where applicable. I consent
            to the collection and processing of my personal data in accordance with the Data Privacy
            Act of 2012 (Republic Act No. 10173).
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
            saveRegistrationDraft(eventId, {
              ...formData,
              mode: registrationMode,
              members: registrationMode === "group" ? members : [],
            });
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
            disabled={loading || isSubmitting || ocrStatus === "scanning"}
            className="registration-form-footer-btn registration-form-footer-btn--primary"
          >
            {loading || isSubmitting
              ? "Processing..."
              : ocrStatus === "scanning"
                ? "Scanning receipt..."
              : registrationMode === "group"
                ? "Submit group registration"
                : "Submit registration"}
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

function UsersSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.5 19c0-2.8 2.2-4.5 5.5-4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="16" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14 19c0-2.2 1.6-3.6 4-3.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
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
