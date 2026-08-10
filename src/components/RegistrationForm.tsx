"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { conference, PNA_ZONES } from "@/lib/conference";
import { formatPeso } from "@/lib/registration-fees";
import type {
  FoodPreference,
  MembershipType,
  RegistrationRateChoice,
  SponsorConsent,
} from "@/lib/types/admin";
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
  fetchEarlyBirdStatus,
  submitGroupRegistration,
  submitReceipt,
  submitRegistration,
  submitRegistrationDocuments,
} from "@/lib/api/registrations";
import {
  RegistrationSuccessModal,
  type RegistrationSuccessDetails,
} from "@/components/RegistrationSuccessModal";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { MessageDialog } from "@/components/ui/MessageDialog";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { PnaSelect, type PnaSelectOption } from "@/components/ui/PnaSelect";
import { RegistrationPaymentQr } from "@/components/RegistrationPaymentQr";
import type { RegistrationPaymentBreakdown } from "@/components/RegistrationSidebar";
import { MAX_GROUP_SIZE } from "@/lib/registrations-constants";
import {
  REGISTRATION_STEPS,
  type RegistrationFormPhase,
  type RegistrationStepLabel,
  type RegistrationStepState,
  type RegistrationStepStatus,
} from "@/lib/registration-steps";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface FormData {
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  organization: string;
  institutionAddress: string;
  position: string;

  membershipType: MembershipType | "";
  pnaIdNumber: string;
  pnaZone: string;
  pnaChapter: string;

  prcLicenseNumber: string;
  prcInitialRegistrationDate: string;
  prcExpirationDate: string;

  registrationMode: RegistrationMode;
  registrationRate: RegistrationRateChoice | "";
  seniorPwdIdNumber: string;

  foodPreference: FoodPreference | "";
  foodAllergyNote: string;

  sponsorConsent: SponsorConsent | "";
  dataPrivacyConsent: boolean;
}

interface FileFields {
  pnaIdFile: File | null;
  prcIdFile: File | null;
  seniorPwdIdFile: File | null;
  receiptFile: File | null;
  bir2303File: File | null;
  bir2307File: File | null;
}

type FormFieldKey = keyof FormData;

type ErrorKey =
  | FormFieldKey
  | "pnaIdFile"
  | "prcIdFile"
  | "seniorPwdIdFile"
  | "receiptFile"
  | "bir2303File"
  | "bir2307File"
  | "paymentReference"
  | "members";

type Errors = Partial<Record<ErrorKey, string>>;

const initialFormData: FormData = {
  lastName: "",
  firstName: "",
  middleName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  organization: "",
  institutionAddress: "",
  position: "",

  membershipType: "",
  pnaIdNumber: "",
  pnaZone: "",
  pnaChapter: "",

  prcLicenseNumber: "",
  prcInitialRegistrationDate: "",
  prcExpirationDate: "",

  registrationMode: "single",
  registrationRate: "",
  seniorPwdIdNumber: "",

  foodPreference: "",
  foodAllergyNote: "",

  sponsorConsent: "",
  dataPrivacyConsent: false,
};

const initialFiles: FileFields = {
  pnaIdFile: null,
  prcIdFile: null,
  seniorPwdIdFile: null,
  receiptFile: null,
  bir2303File: null,
  bir2307File: null,
};

const GENDER_OPTIONS: PnaSelectOption[] = [
  { value: "", label: "Select gender" },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Prefer not to say", label: "Prefer not to say" },
];

const MEMBERSHIP_TYPE_OPTIONS: PnaSelectOption[] = [
  { value: "", label: "Select membership type" },
  { value: "lifetime", label: "Lifetime Member" },
  { value: "regular", label: "Regular Member" },
  { value: "non_member", label: "Non-Member" },
];

const PNA_ZONE_OPTIONS: PnaSelectOption[] = [
  { value: "", label: "Select PNA zone" },
  ...PNA_ZONES.map((zone) => ({ value: zone, label: zone })),
];

const FOOD_PREFERENCE_OPTIONS: PnaSelectOption[] = [
  { value: "", label: "Select food preference" },
  { value: "regular", label: "Regular" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "no_pork", label: "No Pork" },
  { value: "allergy", label: "Food Allergy" },
];

function calculateAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function isValidDateString(value: string): boolean {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/** Local calendar date as YYYY-MM-DD for date inputs. */
function getTodayDateInput(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isFutureDateInput(value: string): boolean {
  return Boolean(value) && value > getTodayDateInput();
}

function isExpiredDateInput(value: string): boolean {
  return Boolean(value) && isValidDateString(value) && value < getTodayDateInput();
}

function formatDisplayName(parts: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
}): string {
  return [parts.firstName, parts.middleName, parts.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function getFieldError(field: FormFieldKey, data: FormData): string | undefined {
  switch (field) {
    case "lastName":
      return getNameLengthError(data.lastName, "lastName", "Surname") ?? undefined;
    case "firstName":
      return getNameLengthError(data.firstName, "firstName", "First name") ?? undefined;
    case "middleName":
      return data.middleName.trim() ? undefined : "Middle name is required";
    case "email":
      return getEmailValidationError(data.email) ?? undefined;
    case "phone":
      return getRegistrationPhoneValidationError(data.phone) ?? undefined;
    case "dateOfBirth":
      if (!data.dateOfBirth) return "Date of birth is required";
      if (!isValidDateString(data.dateOfBirth)) return "Enter a valid date of birth";
      if (new Date(data.dateOfBirth) > new Date()) return "Date of birth cannot be in the future";
      return undefined;
    case "gender":
      return data.gender.trim() ? undefined : "Please select a gender";
    case "organization":
      return data.organization.trim() ? undefined : "Institution / organization is required";
    case "institutionAddress":
      return data.institutionAddress.trim() ? undefined : "Institution address is required";
    case "position":
      return data.position.trim() ? undefined : "Position/title is required";
    case "membershipType":
      return data.membershipType ? undefined : "Please select a membership type";
    case "pnaIdNumber":
      return data.pnaIdNumber.trim() ? undefined : "PNA ID number is required";
    case "pnaZone":
      return data.pnaZone ? undefined : "Please select a PNA zone";
    case "pnaChapter":
      return data.pnaChapter.trim() ? undefined : "PNA chapter is required";
    case "prcLicenseNumber":
      return data.prcLicenseNumber.trim() ? undefined : "PRC license number is required";
    case "prcInitialRegistrationDate":
      if (!data.prcInitialRegistrationDate) return "Initial registration date is required";
      if (!isValidDateString(data.prcInitialRegistrationDate)) return "Enter a valid date";
      if (isFutureDateInput(data.prcInitialRegistrationDate)) {
        return "Initial registration date cannot be in the future";
      }
      return undefined;
    case "prcExpirationDate":
      if (!data.prcExpirationDate) return "Expiration date is required";
      if (!isValidDateString(data.prcExpirationDate)) return "Enter a valid date";
      if (
        isValidDateString(data.prcInitialRegistrationDate) &&
        data.prcExpirationDate < data.prcInitialRegistrationDate
      ) {
        return "Expiration date must be after the initial registration date";
      }
      if (isExpiredDateInput(data.prcExpirationDate)) {
        return "Your PRC license is expired. Please renew it before registering.";
      }
      return undefined;
    case "registrationMode":
      return data.registrationMode ? undefined : "Please select a registration type";
    case "registrationRate":
      return data.registrationRate ? undefined : "Please choose your registration rate";
    case "seniorPwdIdNumber":
      if (data.registrationRate !== "seniorPwd") return undefined;
      return data.seniorPwdIdNumber.trim()
        ? undefined
        : "Senior Citizen / PWD ID number is required";
    case "foodPreference":
      return data.foodPreference ? undefined : "Please select a food preference";
    case "foodAllergyNote":
      if (data.foodPreference !== "allergy") return undefined;
      return data.foodAllergyNote.trim() ? undefined : "Please describe the food allergy";
    case "sponsorConsent":
      return data.sponsorConsent ? undefined : "Please choose an option";
    case "dataPrivacyConsent":
      return data.dataPrivacyConsent ? undefined : "You must consent to data processing";
    default:
      return undefined;
  }
}

const PERSONAL_FIELDS: FormFieldKey[] = [
  "lastName",
  "firstName",
  "middleName",
  "email",
  "phone",
  "dateOfBirth",
  "gender",
  "organization",
  "institutionAddress",
  "position",
];

const MEMBERSHIP_FIELDS: FormFieldKey[] = ["membershipType", "pnaIdNumber", "pnaZone", "pnaChapter"];

const LICENSE_FIELDS: FormFieldKey[] = [
  "prcLicenseNumber",
  "prcInitialRegistrationDate",
  "prcExpirationDate",
];

const PAYMENT_FIELDS: FormFieldKey[] = ["registrationMode", "registrationRate", "foodPreference"];

const REVIEW_FIELDS: FormFieldKey[] = ["sponsorConsent", "dataPrivacyConsent"];

const DETAILS_VALIDATE_FIELDS: FormFieldKey[] = [
  ...PERSONAL_FIELDS,
  ...MEMBERSHIP_FIELDS,
  ...LICENSE_FIELDS,
];

const MEMBER_VALIDATE_FIELDS: (keyof GroupMemberDraft)[] = [
  "lastName",
  "firstName",
  "middleName",
  "email",
  "phone",
  "dateOfBirth",
  "prcLicenseNumber",
  "prcInitialRegistrationDate",
  "prcExpirationDate",
  "registrationRate",
  "seniorPwdIdNumber",
  "foodPreference",
  "foodAllergyNote",
];

function getMemberFieldError(
  member: GroupMemberDraft,
  field: keyof GroupMemberDraft
): string | undefined {
  switch (field) {
    case "lastName":
      return getNameLengthError(member.lastName, "lastName", "Surname") ?? undefined;
    case "firstName":
      return getNameLengthError(member.firstName, "firstName", "First name") ?? undefined;
    case "middleName":
      return member.middleName.trim() ? undefined : "Middle name is required";
    case "email":
      return getEmailValidationError(member.email) ?? undefined;
    case "phone":
      return getRegistrationPhoneValidationError(member.phone) ?? undefined;
    case "dateOfBirth":
      return member.dateOfBirth ? undefined : "Date of birth is required";
    case "prcLicenseNumber":
      return member.prcLicenseNumber.trim() ? undefined : "PRC license number is required";
    case "prcInitialRegistrationDate":
      if (!member.prcInitialRegistrationDate) return "Initial registration date is required";
      if (!isValidDateString(member.prcInitialRegistrationDate)) return "Enter a valid date";
      if (isFutureDateInput(member.prcInitialRegistrationDate)) {
        return "Initial registration date cannot be in the future";
      }
      return undefined;
    case "prcExpirationDate":
      if (!member.prcExpirationDate) return "Expiration date is required";
      if (!isValidDateString(member.prcExpirationDate)) return "Enter a valid date";
      if (
        isValidDateString(member.prcInitialRegistrationDate) &&
        member.prcExpirationDate < member.prcInitialRegistrationDate
      ) {
        return "Expiration date must be after the initial registration date";
      }
      if (isExpiredDateInput(member.prcExpirationDate)) {
        return "PRC license is expired. Please renew it before registering.";
      }
      return undefined;
    case "registrationRate":
      return member.registrationRate ? undefined : "Please choose Regular or Senior Citizen/PWD";
    case "seniorPwdIdNumber":
      if (member.registrationRate !== "seniorPwd") return undefined;
      return member.seniorPwdIdNumber.trim()
        ? undefined
        : "Senior Citizen/PWD ID number is required";
    case "foodPreference":
      return member.foodPreference ? undefined : "Food preference is required";
    case "foodAllergyNote":
      if (member.foodPreference !== "allergy") return undefined;
      return member.foodAllergyNote.trim() ? undefined : "Please describe the food allergy";
    default:
      return undefined;
  }
}

function computeMembersValid(members: GroupMemberDraft[], primaryEmail: string): boolean {
  if (members.length < 1) return false;
  const emails = [primaryEmail.trim().toLowerCase()];
  for (const member of members) {
    for (const field of MEMBER_VALIDATE_FIELDS) {
      if (getMemberFieldError(member, field)) return false;
    }
    const email = member.email.trim().toLowerCase();
    if (!email || emails.includes(email)) return false;
    emails.push(email);
  }
  return true;
}

function getSectionStatus(
  label: RegistrationStepLabel,
  data: FormData,
  touched: Partial<Record<FormFieldKey, boolean>>,
  files: FileFields,
  paymentReference: string,
  referenceConfirmed: boolean,
  membersValid: boolean,
  phase: RegistrationFormPhase
): RegistrationStepStatus {
  if (label === "Personal") {
    const errs = PERSONAL_FIELDS.map((field) => getFieldError(field, data));
    const isComplete = errs.every((error) => !error);
    const anyTouched = PERSONAL_FIELDS.some((field) => touched[field]);
    if (isComplete) return "complete";
    if (anyTouched && errs.some(Boolean)) return "error";
    return "pending";
  }

  if (label === "Membership") {
    const errs = MEMBERSHIP_FIELDS.map((field) => getFieldError(field, data));
    const fileOk = Boolean(files.pnaIdFile);
    const isComplete = errs.every((error) => !error) && fileOk;
    const anyTouched = MEMBERSHIP_FIELDS.some((field) => touched[field]) || fileOk;
    if (isComplete) return "complete";
    if (anyTouched && (errs.some(Boolean) || !fileOk)) return "error";
    return "pending";
  }

  if (label === "License") {
    const errs = LICENSE_FIELDS.map((field) => getFieldError(field, data));
    const fileOk = Boolean(files.prcIdFile);
    const isComplete = errs.every((error) => !error) && fileOk;
    const anyTouched = LICENSE_FIELDS.some((field) => touched[field]) || fileOk;
    if (isComplete) return "complete";
    if (anyTouched && (errs.some(Boolean) || !fileOk)) return "error";
    return "pending";
  }

  if (label === "Payment") {
    if (phase === "details") return "pending";
    const fields: FormFieldKey[] = [...PAYMENT_FIELDS];
    if (data.registrationRate === "seniorPwd") fields.push("seniorPwdIdNumber");
    if (data.foodPreference === "allergy") fields.push("foodAllergyNote");
    const errs = fields.map((field) => getFieldError(field, data));
    const receiptOk = Boolean(files.receiptFile);
    const bir2303Ok = Boolean(files.bir2303File);
    const refOk = paymentReference.trim().length >= 4 && referenceConfirmed;
    const membersOk = data.registrationMode !== "group" || membersValid;
    const isComplete = errs.every((error) => !error) && receiptOk && bir2303Ok && refOk && membersOk;
    const anyTouched =
      PAYMENT_FIELDS.some((field) => touched[field]) ||
      receiptOk ||
      paymentReference.trim().length > 0;
    if (isComplete) return "complete";
    if (anyTouched) return "error";
    return "pending";
  }

  // Review
  if (phase === "details") return "pending";
  const errs = REVIEW_FIELDS.map((field) => getFieldError(field, data));
  const isComplete = errs.every((error) => !error);
  const anyTouched = REVIEW_FIELDS.some((field) => touched[field]);
  if (isComplete) return "complete";
  if (anyTouched && errs.some(Boolean)) return "error";
  return "pending";
}

function buildStepStates(
  data: FormData,
  touched: Partial<Record<FormFieldKey, boolean>>,
  files: FileFields,
  paymentReference: string,
  referenceConfirmed: boolean,
  membersValid: boolean,
  phase: RegistrationFormPhase
): RegistrationStepState[] {
  const raw = REGISTRATION_STEPS.map((label) => ({
    label,
    status: getSectionStatus(
      label,
      data,
      touched,
      files,
      paymentReference,
      referenceConfirmed,
      membersValid,
      phase
    ),
  }));

  let activeAssigned = false;
  return raw.map((step) => {
    if (step.status === "complete" || step.status === "error") {
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
  const [members, setMembers] = useState<GroupMemberDraft[]>([]);
  const [memberErrors, setMemberErrors] = useState<
    Record<number, Partial<Record<keyof GroupMemberDraft, string>>>
  >({});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [showDraftRestored, setShowDraftRestored] = useState(false);
  const [formPhase, setFormPhase] = useState<RegistrationFormPhase>("details");
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<FormFieldKey, boolean>>>({});

  const [pnaIdFile, setPnaIdFile] = useState<File | null>(null);
  const [prcIdFile, setPrcIdFile] = useState<File | null>(null);
  const [seniorPwdIdFile, setSeniorPwdIdFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [bir2303File, setBir2303File] = useState<File | null>(null);
  const [bir2307File, setBir2307File] = useState<File | null>(null);

  const [paymentReference, setPaymentReference] = useState("");
  const [ocrStatus, setOcrStatus] = useState<"idle" | "scanning" | "done" | "unavailable">("idle");
  const [ocrMessage, setOcrMessage] = useState("");
  const [referenceConfirmed, setReferenceConfirmed] = useState(false);

  const [earlyBird, setEarlyBird] = useState<{
    used: number;
    cap: number;
    remaining: number;
    earlyBirdAmount: number;
    regularAmount: number;
    seniorPwdAmount: number;
  } | null>(null);

  const [successDetails, setSuccessDetails] = useState<RegistrationSuccessDetails | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);
  const [prcExpiredNotice, setPrcExpiredNotice] = useState<{
    open: boolean;
    who: string;
  }>({ open: false, who: "" });

  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  const files: FileFields = useMemo(
    () => ({ pnaIdFile, prcIdFile, seniorPwdIdFile, receiptFile, bir2303File, bir2307File }),
    [pnaIdFile, prcIdFile, seniorPwdIdFile, receiptFile, bir2303File, bir2307File]
  );

  const membersValid = useMemo(
    () =>
      formData.registrationMode !== "group" || computeMembersValid(members, formData.email),
    [formData.registrationMode, members, formData.email]
  );

  const fallbackFees = conference.registration.fees;
  const earlyBirdAmount = earlyBird?.earlyBirdAmount ?? fallbackFees.earlyBird.amount;
  const regularAmount = earlyBird?.regularAmount ?? fallbackFees.regular.amount;
  const seniorPwdAmount = earlyBird?.seniorPwdAmount ?? fallbackFees.seniorPwd.amount;
  const remaining = earlyBird?.remaining ?? 0;

  const appliedFee = useMemo(() => {
    if (!formData.registrationRate) return null;
    if (formData.registrationRate === "seniorPwd") {
      return { amount: seniorPwdAmount, label: fallbackFees.seniorPwd.label };
    }
    if (remaining > 0) {
      return { amount: earlyBirdAmount, label: fallbackFees.earlyBird.label };
    }
    return { amount: regularAmount, label: fallbackFees.regular.label };
  }, [
    formData.registrationRate,
    remaining,
    earlyBirdAmount,
    regularAmount,
    seniorPwdAmount,
    fallbackFees,
  ]);

  const feeLines = useMemo(() => {
    const lines: { key: string; name: string; label: string; amount: number }[] = [];
    let earlyUsed = 0;

    const resolveLine = (
      rate: RegistrationRateChoice | "",
      name: string,
      key: string
    ) => {
      if (!rate) return;
      if (rate === "seniorPwd") {
        lines.push({
          key,
          name,
          label: fallbackFees.seniorPwd.label,
          amount: seniorPwdAmount,
        });
        return;
      }
      if (remaining - earlyUsed > 0) {
        lines.push({
          key,
          name,
          label: fallbackFees.earlyBird.label,
          amount: earlyBirdAmount,
        });
        earlyUsed += 1;
        return;
      }
      lines.push({
        key,
        name,
        label: fallbackFees.regular.label,
        amount: regularAmount,
      });
    };

    resolveLine(
      formData.registrationRate,
      formData.firstName.trim() || "You",
      "primary"
    );

    if (formData.registrationMode === "group") {
      members.forEach((member, index) => {
        resolveLine(
          member.registrationRate,
          member.firstName.trim() || `Participant ${index + 2}`,
          `member-${index}`
        );
      });
    }

    return lines;
  }, [
    formData.registrationRate,
    formData.firstName,
    formData.registrationMode,
    members,
    remaining,
    earlyBirdAmount,
    regularAmount,
    seniorPwdAmount,
    fallbackFees,
  ]);

  const headcount = formData.registrationMode === "group" ? 1 + members.length : 1;
  const unitFee = appliedFee?.amount ?? 0;
  const totalFee = feeLines.reduce((sum, line) => sum + line.amount, 0);
  const feeSummaryLabel =
    formData.registrationMode === "group" && feeLines.length > 1
      ? feeLines.every((line) => line.label === feeLines[0]?.label)
        ? feeLines[0].label
        : "Combined rates"
      : appliedFee?.label ?? "Conference Registration";

  useEffect(() => {
    const draft = loadRegistrationDraft(eventId);
    if (draft) {
      setFormData({
        lastName: draft.lastName,
        firstName: draft.firstName,
        middleName: draft.middleName,
        email: draft.email,
        phone: toPhMobileLocalDigits(draft.phone),
        dateOfBirth: draft.dateOfBirth,
        gender: draft.gender,
        organization: draft.organization,
        institutionAddress: draft.institutionAddress,
        position: draft.position,
        membershipType: draft.membershipType,
        pnaIdNumber: draft.pnaIdNumber,
        pnaZone: draft.pnaZone,
        pnaChapter: draft.pnaChapter,
        prcLicenseNumber: draft.prcLicenseNumber,
        prcInitialRegistrationDate: draft.prcInitialRegistrationDate,
        prcExpirationDate: draft.prcExpirationDate,
        registrationMode: draft.registrationMode,
        registrationRate: draft.registrationRate,
        seniorPwdIdNumber: draft.seniorPwdIdNumber,
        foodPreference: draft.foodPreference,
        foodAllergyNote: draft.foodAllergyNote,
        sponsorConsent: draft.sponsorConsent,
        dataPrivacyConsent: draft.dataPrivacyConsent,
      });
      setMembers(
        draft.registrationMode === "group"
          ? draft.members.length > 0
            ? draft.members.map((m) => ({ ...m, phone: toPhMobileLocalDigits(m.phone) }))
            : [createEmptyGroupMember()]
          : []
      );
      setPaymentReference(draft.paymentReference ?? "");
      setShowDraftRestored(true);
    } else {
      setFormData(initialFormData);
      setMembers([]);
      setPaymentReference("");
      setShowDraftRestored(false);
    }

    setPnaIdFile(null);
    setPrcIdFile(null);
    setSeniorPwdIdFile(null);
    setReceiptFile(null);
    setBir2303File(null);
    setBir2307File(null);
    setReferenceConfirmed(false);
    setOcrStatus("idle");
    setOcrMessage("");
    setErrors({});
    setMemberErrors({});
    setTouched({});
    setFormPhase("details");
    setEarlyBird(null);
    setDraftLoaded(true);
  }, [eventId]);

  useEffect(() => {
    if (!draftLoaded) return;

    const timeout = window.setTimeout(() => {
      saveRegistrationDraft(eventId, {
        mode: formData.registrationMode,
        lastName: formData.lastName,
        firstName: formData.firstName,
        middleName: formData.middleName,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        age: String(calculateAge(formData.dateOfBirth) ?? ""),
        gender: formData.gender,
        organization: formData.organization,
        institutionAddress: formData.institutionAddress,
        position: formData.position,
        membershipType: formData.membershipType,
        pnaIdNumber: formData.pnaIdNumber,
        pnaZone: formData.pnaZone,
        pnaChapter: formData.pnaChapter,
        prcLicenseNumber: formData.prcLicenseNumber,
        prcInitialRegistrationDate: formData.prcInitialRegistrationDate,
        prcExpirationDate: formData.prcExpirationDate,
        registrationMode: formData.registrationMode,
        registrationRate: formData.registrationRate,
        seniorPwdIdNumber: formData.seniorPwdIdNumber,
        members: formData.registrationMode === "group" ? members : [],
        foodPreference: formData.foodPreference,
        foodAllergyNote: formData.foodAllergyNote,
        sponsorConsent: formData.sponsorConsent,
        dataPrivacyConsent: formData.dataPrivacyConsent,
        paymentReference,
      });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [draftLoaded, eventId, formData, members, paymentReference]);

  useEffect(() => {
    if (!draftLoaded) return;

    const timeout = window.setTimeout(() => {
      setErrors((prev) => {
        const next: Errors = { ...prev };
        const allFields: FormFieldKey[] = [
          ...PERSONAL_FIELDS,
          ...MEMBERSHIP_FIELDS,
          ...LICENSE_FIELDS,
          ...PAYMENT_FIELDS,
          "seniorPwdIdNumber",
          "foodAllergyNote",
          ...REVIEW_FIELDS,
        ];

        for (const field of allFields) {
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
      buildStepStates(
        formData,
        touched,
        files,
        paymentReference,
        referenceConfirmed,
        membersValid,
        formPhase
      )
    );
  }, [
    formData,
    touched,
    files,
    paymentReference,
    referenceConfirmed,
    membersValid,
    formPhase,
    onStepStatesChange,
  ]);

  useEffect(() => {
    if (formPhase !== "payment") return;
    let cancelled = false;

    fetchEarlyBirdStatus(eventId)
      .then((status) => {
        if (!cancelled) setEarlyBird(status);
      })
      .catch(() => {
        if (!cancelled) setEarlyBird(null);
      });

    return () => {
      cancelled = true;
    };
  }, [formPhase, eventId]);

  useEffect(() => {
    if (!onPaymentBreakdownChange) return;

    if (formPhase !== "payment" || !appliedFee) {
      onPaymentBreakdownChange(null);
      return;
    }

    onPaymentBreakdownChange({
      categoryLabel:
        formData.registrationMode === "group"
          ? "Group registration"
          : "Conference Registration",
      feeTierLabel: feeSummaryLabel,
      unitFee: formData.registrationMode === "group" ? totalFee : unitFee,
      headcount,
      totalFee,
    });
  }, [
    formPhase,
    appliedFee,
    feeSummaryLabel,
    formData.registrationMode,
    headcount,
    totalFee,
    unitFee,
    onPaymentBreakdownChange,
  ]);

  function validateMembers(): boolean {
    if (formData.registrationMode !== "group") {
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
        members: "Add at least one additional participant sharing this payment.",
      }));
      return false;
    }

    const nextMemberErrors: Record<number, Partial<Record<keyof GroupMemberDraft, string>>> = {};
    const emails = [formData.email.trim().toLowerCase()];
    let ok = true;

    members.forEach((member, index) => {
      const fieldErrors: Partial<Record<keyof GroupMemberDraft, string>> = {};
      for (const field of MEMBER_VALIDATE_FIELDS) {
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

    const expiredMember = members.findIndex((member) =>
      isExpiredDateInput(member.prcExpirationDate)
    );
    if (expiredMember >= 0) {
      showPrcExpiredNotice(`Participant ${expiredMember + 2}`);
    }

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
    const newErrors: Errors = {};
    const allTouched: Partial<Record<FormFieldKey, boolean>> = { ...touched };

    for (const field of DETAILS_VALIDATE_FIELDS) {
      allTouched[field] = true;
      const error = getFieldError(field, formData);
      if (error) newErrors[field] = error;
    }

    if (!pnaIdFile) newErrors.pnaIdFile = "Please upload a copy of your PNA ID.";
    if (!prcIdFile) newErrors.prcIdFile = "Please upload a copy of your valid PRC ID.";

    setTouched(allTouched);
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of DETAILS_VALIDATE_FIELDS) {
        if (newErrors[field]) next[field] = newErrors[field];
        else delete next[field];
      }
      if (newErrors.pnaIdFile) next.pnaIdFile = newErrors.pnaIdFile;
      else delete next.pnaIdFile;
      if (newErrors.prcIdFile) next.prcIdFile = newErrors.prcIdFile;
      else delete next.prcIdFile;
      return next;
    });

    if (isExpiredDateInput(formData.prcExpirationDate)) {
      showPrcExpiredNotice("Participant 1");
    }

    return Object.keys(newErrors).length === 0;
  }

  function validatePayment(): boolean {
    const newErrors: Errors = {};
    const allTouched: Partial<Record<FormFieldKey, boolean>> = { ...touched };

    const fieldsToCheck: FormFieldKey[] = [...PAYMENT_FIELDS, ...REVIEW_FIELDS];
    if (formData.registrationRate === "seniorPwd") fieldsToCheck.push("seniorPwdIdNumber");
    if (formData.foodPreference === "allergy") fieldsToCheck.push("foodAllergyNote");

    for (const field of fieldsToCheck) {
      allTouched[field] = true;
      const error = getFieldError(field, formData);
      if (error) newErrors[field] = error;
    }

    if (!receiptFile) {
      newErrors.receiptFile = "Proof of payment is required before you can submit.";
    } else if (receiptFile.size > MAX_FILE_SIZE) {
      newErrors.receiptFile = "Receipt must be 10 MB or smaller.";
    }

    if (!bir2303File) {
      newErrors.bir2303File = "BIR Form 2303 (Certificate of Registration) is required.";
    }

    const trimmedRef = paymentReference.trim();
    if (!trimmedRef) {
      newErrors.paymentReference = "Enter the payment / transfer reference from your receipt.";
    } else if (trimmedRef.length < 4) {
      newErrors.paymentReference = "Payment reference looks too short. Please check your receipt.";
    } else if (!referenceConfirmed) {
      newErrors.paymentReference =
        "Please confirm the payment reference looks correct before submitting.";
    }

    setTouched(allTouched);
    const membersOk = validateMembers();
    setErrors((prev) => {
      const next: Errors = { ...prev };
      for (const field of fieldsToCheck) {
        if (newErrors[field]) next[field] = newErrors[field];
        else delete next[field];
      }
      if (newErrors.receiptFile) next.receiptFile = newErrors.receiptFile;
      else delete next.receiptFile;
      if (newErrors.bir2303File) next.bir2303File = newErrors.bir2303File;
      else delete next.bir2303File;
      if (newErrors.paymentReference) next.paymentReference = newErrors.paymentReference;
      else delete next.paymentReference;
      return next;
    });

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

  function handleGenericFileSelected(
    file: File | null,
    key: "pnaIdFile" | "prcIdFile" | "seniorPwdIdFile" | "bir2303File" | "bir2307File",
    setFile: (file: File | null) => void
  ) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    if (!file) {
      setFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({ ...prev, [key]: "File must be 10 MB or smaller." }));
      setFile(null);
      return;
    }

    setFile(file);
  }

  async function handleReceiptSelected(file: File | null) {
    setReceiptFile(file);
    setPaymentReference("");
    setReferenceConfirmed(false);
    setOcrMessage("");
    setOcrStatus("idle");
    setErrors((prev) => {
      const next = { ...prev };
      delete next.receiptFile;
      delete next.paymentReference;
      return next;
    });

    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({
        ...prev,
        receiptFile: "Receipt must be 10 MB or smaller.",
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

  function resetFormState() {
    setFormData(initialFormData);
    setMembers([]);
    setShowDraftRestored(false);
    setPnaIdFile(null);
    setPrcIdFile(null);
    setSeniorPwdIdFile(null);
    setReceiptFile(null);
    setBir2303File(null);
    setBir2307File(null);
    setPaymentReference("");
    setOcrStatus("idle");
    setOcrMessage("");
    setReferenceConfirmed(false);
    setErrors({});
    setMemberErrors({});
    setTouched({});
    setFormPhase("details");
    setEarlyBird(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (formPhase !== "payment") {
      handleContinueToPayment();
      return;
    }

    if (!validatePayment()) return;

    const isGroup = formData.registrationMode === "group";
    requestConfirm({
      title: "Submit registration?",
      message: isGroup
        ? `Submit group registration for ${headcount} participants with one combined payment of ${formatPeso(totalFee)}? Each person will receive their own reference number by email.`
        : "Are you sure you want to submit your official registration? Please confirm your details are correct before continuing.",
      confirmLabel: "Submit registration",
      loadingMessage: "Submitting registration and uploading documents...",
      errorTitle: "Registration could not be submitted",
      showSuccess: false,
      action: async () => {
        try {
          const phone = toPhMobileInternational(formData.phone);
          if (!phone) {
            throw new Error("Enter a valid mobile number starting with 9 (e.g. 9606207919).");
          }

          const age = calculateAge(formData.dateOfBirth);

          const primaryPayload = {
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            middleName: formData.middleName.trim(),
            email: formData.email.trim(),
            phone,
            dateOfBirth: formData.dateOfBirth,
            age,
            gender: formData.gender,
            organization: formData.organization.trim(),
            institutionAddress: formData.institutionAddress.trim(),
            position: formData.position.trim(),
            membershipType: formData.membershipType as MembershipType,
            pnaIdNumber: formData.pnaIdNumber.trim(),
            pnaZone: formData.pnaZone,
            pnaChapter: formData.pnaChapter.trim(),
            prcLicenseNumber: formData.prcLicenseNumber.trim(),
            prcInitialRegistrationDate: formData.prcInitialRegistrationDate,
            prcExpirationDate: formData.prcExpirationDate,
            registrationMode: formData.registrationMode,
            registrationRate: formData.registrationRate as RegistrationRateChoice,
            seniorPwdIdNumber:
              formData.registrationRate === "seniorPwd"
                ? formData.seniorPwdIdNumber.trim()
                : undefined,
            foodPreference: formData.foodPreference as FoodPreference,
            foodAllergyNote: formData.foodAllergyNote.trim() || undefined,
            sponsorConsent: formData.sponsorConsent as SponsorConsent,
            dataPrivacyConsent: formData.dataPrivacyConsent,
            paymentReference: paymentReference.trim(),
            eventId,
          };

          let registration;
          let groupMeta: {
            groupSize: number;
            totalPaymentAmount: number;
            participants: {
              referenceNumber: string;
              firstName: string;
              lastName: string;
              middleInitial?: string;
              email: string;
            }[];
          } | null = null;

          if (isGroup) {
            const result = await submitGroupRegistration({
              primary: primaryPayload,
              members: members.map((member) => ({
                firstName: member.firstName.trim(),
                lastName: member.lastName.trim(),
                middleName: member.middleName.trim(),
                email: member.email.trim(),
                phone: toPhMobileInternational(member.phone) ?? member.phone,
                dateOfBirth: member.dateOfBirth,
                prcLicenseNumber: member.prcLicenseNumber.trim(),
                prcInitialRegistrationDate: member.prcInitialRegistrationDate,
                prcExpirationDate: member.prcExpirationDate,
                foodPreference: member.foodPreference,
                foodAllergyNote: member.foodAllergyNote.trim() || undefined,
                registrationRate: member.registrationRate as RegistrationRateChoice,
                seniorPwdIdNumber:
                  member.registrationRate === "seniorPwd"
                    ? member.seniorPwdIdNumber.trim()
                    : undefined,
              })),
              eventId,
            });
            registration = result.registration;
            groupMeta = {
              groupSize: result.group.groupSize ?? headcount,
              totalPaymentAmount: result.group.totalPaymentAmount,
              participants: result.group.participants,
            };
          } else {
            registration = await submitRegistration(primaryPayload);
          }

          let receiptUploaded = false;
          let receiptUploadFailed = false;
          try {
            await submitReceipt(
              registration.referenceNumber,
              receiptFile!,
              formData.email.trim(),
              paymentReference.trim()
            );
            receiptUploaded = true;
          } catch {
            receiptUploadFailed = true;
          }

          try {
            await submitRegistrationDocuments({
              referenceNumber: registration.referenceNumber,
              email: formData.email.trim(),
              pnaId: pnaIdFile,
              prcId: prcIdFile,
              bir2303: bir2303File,
              bir2307: bir2307File,
              seniorPwdId: formData.registrationRate === "seniorPwd" ? seniorPwdIdFile : null,
            });
          } catch {
            // Best-effort document upload; registration itself already succeeded.
          }

          const middleInitial =
            (registration.middleName ?? formData.middleName).trim().charAt(0) || undefined;

          const details: RegistrationSuccessDetails = {
            referenceNumber: registration.referenceNumber,
            firstName: registration.firstName,
            lastName: registration.lastName,
            middleInitial,
            email: registration.email,
            phone,
            organization: formData.organization.trim(),
            position: formData.position.trim(),
            category: registration.feeLabel || feeSummaryLabel || "Conference Registration",
            receiptUploaded,
            receiptUploadFailed,
            groupSize: groupMeta?.groupSize,
            totalPaymentAmount: groupMeta?.totalPaymentAmount ?? totalFee,
            groupMembers: groupMeta?.participants.map((participant) => ({
              firstName: participant.firstName,
              lastName: participant.lastName,
              middleInitial: participant.middleInitial,
              email: participant.email,
              referenceNumber: participant.referenceNumber,
            })),
          };

          setSuccessDetails(details);
          setShowSuccessModal(true);
          clearRegistrationDraft(eventId);
          resetFormState();
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

  function showPrcExpiredNotice(who: string) {
    setPrcExpiredNotice({ open: true, who });
  }

  function handlePrimaryPrcExpirationChange(value: string) {
    updateField("prcExpirationDate", value);
    if (isExpiredDateInput(value)) {
      showPrcExpiredNotice("Participant 1");
    }
  }

  function handleMemberPrcExpirationChange(index: number, value: string) {
    updateMember(index, "prcExpirationDate", value);
    if (isExpiredDateInput(value)) {
      showPrcExpiredNotice(`Participant ${index + 2}`);
    }
  }

  function updateField<K extends FormFieldKey>(field: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function setRegistrationMode(mode: RegistrationMode) {
    updateField("registrationMode", mode);
    if (mode === "group" && members.length === 0) {
      setMembers([createEmptyGroupMember()]);
    }
    if (mode === "single") {
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
        if (field === "phone") {
          return { ...member, phone: toPhMobileLocalDigits(value) };
        }
        if (field === "firstName") {
          return { ...member, firstName: value.slice(0, NAME_LIMITS.firstName) };
        }
        if (field === "lastName") {
          return { ...member, lastName: value.slice(0, NAME_LIMITS.lastName) };
        }
        if (field === "foodPreference") {
          return { ...member, foodPreference: value as FoodPreference };
        }
        if (field === "registrationRate") {
          const registrationRate =
            value === "seniorPwd" || value === "regular" ? value : ("" as const);
          return {
            ...member,
            registrationRate,
            seniorPwdIdNumber:
              registrationRate === "seniorPwd" ? member.seniorPwdIdNumber : "",
          };
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
  const age = calculateAge(formData.dateOfBirth);

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
        <MessageDialog
          open={prcExpiredNotice.open}
          title="PRC license expired"
          message={`${prcExpiredNotice.who}: your PRC license expiration date has already passed. Please renew your PRC license before completing registration, then enter the updated expiration date.`}
          variant="error"
          closeLabel="OK"
          onClose={() => setPrcExpiredNotice({ open: false, who: "" })}
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
                    label="Middle Name"
                    id="middleName"
                    required
                    value={formData.middleName}
                    onChange={(v) => updateField("middleName", v)}
                    onBlur={() => markFieldTouched("middleName")}
                    error={errors.middleName}
                    placeholder="Santos"
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
                  <PhoneField
                    id="phone"
                    value={formData.phone}
                    onChange={(v) => updateField("phone", v)}
                    onBlur={() => markFieldTouched("phone")}
                    error={errors.phone}
                  />
                  <FormField
                    label="Date of Birth"
                    id="dateOfBirth"
                    type="date"
                    required
                    value={formData.dateOfBirth}
                    onChange={(v) => updateField("dateOfBirth", v)}
                    onBlur={() => markFieldTouched("dateOfBirth")}
                    error={errors.dateOfBirth}
                  />
                  <div className="col-12 col-md-6">
                    <label htmlFor="age" className="form-label registration-form-label">
                      Age
                      <span className="registration-form-optional"> (Automatic)</span>
                    </label>
                    <input
                      id="age"
                      type="text"
                      readOnly
                      value={age ?? ""}
                      placeholder="—"
                      className="input-dark"
                    />
                  </div>
                  <SelectField
                    label="Gender"
                    id="gender"
                    required
                    value={formData.gender}
                    onChange={(v) => updateField("gender", v)}
                    options={GENDER_OPTIONS}
                    error={errors.gender}
                    placeholder="Select gender"
                  />
                  <FormField
                    label="Institution / Organization"
                    id="organization"
                    required
                    value={formData.organization}
                    onChange={(v) => updateField("organization", v)}
                    onBlur={() => markFieldTouched("organization")}
                    error={errors.organization}
                    className="col-12"
                  />
                  <FormField
                    label="Institution Address"
                    id="institutionAddress"
                    required
                    value={formData.institutionAddress}
                    onChange={(v) => updateField("institutionAddress", v)}
                    onBlur={() => markFieldTouched("institutionAddress")}
                    error={errors.institutionAddress}
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
                    className="col-12"
                  />
                </div>
              </fieldset>

              <fieldset className="registration-form-section">
                <legend className="registration-form-legend">
                  <IdCardSectionIcon />
                  Membership Information
                </legend>
                <div className="row g-3">
                  <SelectField
                    label="Membership Type"
                    id="membershipType"
                    required
                    value={formData.membershipType}
                    onChange={(v) => updateField("membershipType", v as MembershipType | "")}
                    options={MEMBERSHIP_TYPE_OPTIONS}
                    error={errors.membershipType}
                    placeholder="Select membership type"
                  />
                  <FormField
                    label="PNA ID Number"
                    id="pnaIdNumber"
                    required
                    value={formData.pnaIdNumber}
                    onChange={(v) => updateField("pnaIdNumber", v)}
                    onBlur={() => markFieldTouched("pnaIdNumber")}
                    error={errors.pnaIdNumber}
                  />
                  <SelectField
                    label="PNA Zone"
                    id="pnaZone"
                    required
                    value={formData.pnaZone}
                    onChange={(v) => updateField("pnaZone", v)}
                    options={PNA_ZONE_OPTIONS}
                    error={errors.pnaZone}
                    placeholder="Select PNA zone"
                  />
                  <FormField
                    label="PNA Chapter"
                    id="pnaChapter"
                    required
                    value={formData.pnaChapter}
                    onChange={(v) => updateField("pnaChapter", v)}
                    onBlur={() => markFieldTouched("pnaChapter")}
                    error={errors.pnaChapter}
                  />
                  <FileField
                    label="Upload PNA ID"
                    id="pnaIdFile"
                    required
                    accept="image/*"
                    hint="(Image, max 10 MB)"
                    file={pnaIdFile}
                    onChange={(file) => handleGenericFileSelected(file, "pnaIdFile", setPnaIdFile)}
                    error={errors.pnaIdFile}
                    className="col-12"
                  />
                </div>
              </fieldset>

              <fieldset className="registration-form-section">
                <legend className="registration-form-legend">
                  <LicenseSectionIcon />
                  License Information
                </legend>
                <div className="row g-3">
                  <FormField
                    label="PRC License Number"
                    id="prcLicenseNumber"
                    required
                    value={formData.prcLicenseNumber}
                    onChange={(v) => updateField("prcLicenseNumber", v)}
                    onBlur={() => markFieldTouched("prcLicenseNumber")}
                    error={errors.prcLicenseNumber}
                  />
                  <FormField
                    label="Initial Registration Date"
                    id="prcInitialRegistrationDate"
                    type="date"
                    required
                    value={formData.prcInitialRegistrationDate}
                    onChange={(v) => updateField("prcInitialRegistrationDate", v)}
                    onBlur={() => markFieldTouched("prcInitialRegistrationDate")}
                    error={errors.prcInitialRegistrationDate}
                    max={getTodayDateInput()}
                  />
                  <FormField
                    label="Expiration Date"
                    id="prcExpirationDate"
                    type="date"
                    required
                    value={formData.prcExpirationDate}
                    onChange={handlePrimaryPrcExpirationChange}
                    onBlur={() => {
                      markFieldTouched("prcExpirationDate");
                      if (isExpiredDateInput(formData.prcExpirationDate)) {
                        showPrcExpiredNotice("Participant 1");
                      }
                    }}
                    error={errors.prcExpirationDate}
                    min={formData.prcInitialRegistrationDate || undefined}
                  />
                  <FileField
                    label="Upload PRC ID"
                    id="prcIdFile"
                    required
                    accept="image/*"
                    hint="(Image, max 10 MB)"
                    file={prcIdFile}
                    onChange={(file) => handleGenericFileSelected(file, "prcIdFile", setPrcIdFile)}
                    error={errors.prcIdFile}
                    className="col-12"
                  />
                </div>
              </fieldset>
            </>
          ) : (
            <>
              <fieldset className="registration-form-section">
                <legend className="registration-form-legend">
                  <UsersSectionIcon />
                  Registration & Fee
                </legend>
                <p className="registration-form-help mb-3">
                  Choose <strong>Single</strong> for one person, or <strong>Group</strong> when two
                  or more attendees share one deposit slip. Group registration creates a record for
                  every participant in one submission, with one combined payment and one receipt.
                </p>
                <div className="registration-mode-toggle" role="group" aria-label="Registration type">
                  <button
                    type="button"
                    className={`registration-mode-option${
                      formData.registrationMode === "single" ? " is-selected" : ""
                    }`}
                    onClick={() => setRegistrationMode("single")}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    className={`registration-mode-option${
                      formData.registrationMode === "group" ? " is-selected" : ""
                    }`}
                    onClick={() => setRegistrationMode("group")}
                  >
                    Group (one deposit slip)
                  </button>
                </div>
              </fieldset>

              <fieldset className="registration-form-section">
                <legend className="registration-form-legend">
                  <UserSectionIcon />
                  Participant 1
                </legend>
                <div className="registration-participant-summary mb-4">
                  <p className="registration-participant-summary-title mb-2">Your details</p>
                  <dl className="registration-participant-summary-grid mb-0">
                    <div>
                      <dt>Name</dt>
                      <dd>
                        {formatDisplayName(formData) || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{formData.email.trim() || "—"}</dd>
                    </div>
                    <div>
                      <dt>Mobile</dt>
                      <dd>
                        {formData.phone.trim()
                          ? `+63 ${toPhMobileLocalDigits(formData.phone)}`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Date of birth</dt>
                      <dd>{formData.dateOfBirth || "—"}</dd>
                    </div>
                    <div>
                      <dt>Organization</dt>
                      <dd>{formData.organization.trim() || "—"}</dd>
                    </div>
                    <div>
                      <dt>PRC license</dt>
                      <dd>{formData.prcLicenseNumber.trim() || "—"}</dd>
                    </div>
                  </dl>
                </div>

                <p className="form-label registration-form-label mb-2">
                  Registration rate <span className="text-accent">*</span>
                </p>
                <div className="registration-fee-choice-grid">
                  {(["regular", "seniorPwd"] as const).map((rate) => {
                    const amount =
                      rate === "seniorPwd"
                        ? seniorPwdAmount
                        : remaining > 0
                          ? earlyBirdAmount
                          : regularAmount;
                    const tierLabel =
                      rate === "seniorPwd"
                        ? "Senior / PWD"
                        : remaining > 0
                          ? "Early Bird"
                          : "Regular";
                    const meta =
                      rate === "seniorPwd"
                        ? "Valid Senior Citizen or PWD ID required"
                        : "Standard registration rate";
                    const selected = formData.registrationRate === rate;
                    return (
                      <button
                        key={rate}
                        type="button"
                        className={`registration-fee-choice${selected ? " is-selected" : ""}`}
                        onClick={() => updateField("registrationRate", rate)}
                      >
                        <span className="registration-fee-choice-tier">{tierLabel}</span>
                        <span className="registration-fee-choice-amount">{formatPeso(amount)}</span>
                        <span className="registration-fee-choice-meta">{meta}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.registrationRate && (
                  <p className="mt-1 text-xs text-red-400">{errors.registrationRate}</p>
                )}

                {formData.registrationRate === "seniorPwd" ? (
                  <div className="row g-3 mt-1">
                    <FormField
                      label="Senior Citizen / PWD ID Number"
                      id="seniorPwdIdNumber"
                      required
                      value={formData.seniorPwdIdNumber}
                      onChange={(v) => updateField("seniorPwdIdNumber", v)}
                      onBlur={() => markFieldTouched("seniorPwdIdNumber")}
                      error={errors.seniorPwdIdNumber}
                    />
                    <FileField
                      label="Upload Senior Citizen / PWD ID"
                      id="seniorPwdIdFile"
                      accept="image/*"
                      hint="(Optional, image, max 10 MB)"
                      file={seniorPwdIdFile}
                      onChange={(file) =>
                        handleGenericFileSelected(file, "seniorPwdIdFile", setSeniorPwdIdFile)
                      }
                      error={errors.seniorPwdIdFile}
                    />
                  </div>
                ) : null}

                <div className="row g-3 mt-3">
                  <SelectField
                    label="Food Preference"
                    id="foodPreference"
                    required
                    value={formData.foodPreference}
                    onChange={(v) => updateField("foodPreference", v as FoodPreference | "")}
                    options={FOOD_PREFERENCE_OPTIONS}
                    error={errors.foodPreference}
                    placeholder="Select food preference"
                  />
                  {formData.foodPreference === "allergy" ? (
                    <div className="col-12">
                      <label htmlFor="foodAllergyNote" className="form-label registration-form-label">
                        Food Allergy Note <span className="text-accent">*</span>
                      </label>
                      <textarea
                        id="foodAllergyNote"
                        rows={2}
                        value={formData.foodAllergyNote}
                        onChange={(e) => updateField("foodAllergyNote", e.target.value)}
                        onBlur={() => markFieldTouched("foodAllergyNote")}
                        placeholder="Please describe your food allergy"
                        className={`input-dark resize-none ${
                          errors.foodAllergyNote ? "input-dark-error" : ""
                        }`}
                      />
                      {errors.foodAllergyNote && (
                        <p className="mt-1 text-xs text-red-400">{errors.foodAllergyNote}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </fieldset>

              {formData.registrationMode === "group" ? (
                <fieldset className="registration-form-section">
                  <legend className="registration-form-legend">
                    <UsersSectionIcon />
                    Additional participants
                  </legend>
                  <p className="registration-form-help mb-3">
                    Add each attendee sharing one deposit slip. Maximum {MAX_GROUP_SIZE} people
                    including Participant 1. One submission creates a registration for every
                    participant; one payment and one receipt cover the whole group. Each person
                    chooses Regular or Senior Citizen/PWD for their own fee.
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
                            label="Middle Name"
                            id={`member-${index}-middleName`}
                            required
                            value={member.middleName}
                            onChange={(v) => updateMember(index, "middleName", v)}
                            error={memberErrors[index]?.middleName}
                            placeholder="Santos"
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
                          <PhoneField
                            id={`member-${index}-phone`}
                            value={member.phone}
                            onChange={(v) => updateMember(index, "phone", v)}
                            error={memberErrors[index]?.phone}
                          />
                          <FormField
                            label="Date of Birth"
                            id={`member-${index}-dateOfBirth`}
                            type="date"
                            required
                            value={member.dateOfBirth}
                            onChange={(v) => updateMember(index, "dateOfBirth", v)}
                            error={memberErrors[index]?.dateOfBirth}
                            max={getTodayDateInput()}
                          />
                          <FormField
                            label="PRC License Number"
                            id={`member-${index}-prcLicenseNumber`}
                            required
                            value={member.prcLicenseNumber}
                            onChange={(v) => updateMember(index, "prcLicenseNumber", v)}
                            error={memberErrors[index]?.prcLicenseNumber}
                          />
                          <FormField
                            label="PRC Initial Registration Date"
                            id={`member-${index}-prcInitialRegistrationDate`}
                            type="date"
                            required
                            value={member.prcInitialRegistrationDate}
                            onChange={(v) =>
                              updateMember(index, "prcInitialRegistrationDate", v)
                            }
                            error={memberErrors[index]?.prcInitialRegistrationDate}
                            max={getTodayDateInput()}
                          />
                          <FormField
                            label="PRC Expiration Date"
                            id={`member-${index}-prcExpirationDate`}
                            type="date"
                            required
                            value={member.prcExpirationDate}
                            onChange={(v) => handleMemberPrcExpirationChange(index, v)}
                            error={memberErrors[index]?.prcExpirationDate}
                            min={member.prcInitialRegistrationDate || undefined}
                          />
                          <div className="col-12">
                            <p className="form-label registration-form-label mb-2">
                              Registration rate <span className="text-accent">*</span>
                            </p>
                            <div className="registration-fee-choice-grid">
                              {(["regular", "seniorPwd"] as const).map((rate) => {
                                const amount =
                                  rate === "seniorPwd"
                                    ? seniorPwdAmount
                                    : remaining > 0
                                      ? earlyBirdAmount
                                      : regularAmount;
                                const tierLabel =
                                  rate === "seniorPwd"
                                    ? "Senior / PWD"
                                    : remaining > 0
                                      ? "Early Bird"
                                      : "Regular";
                                const meta =
                                  rate === "seniorPwd"
                                    ? "Valid Senior Citizen or PWD ID required"
                                    : "Standard registration rate";
                                const selected = member.registrationRate === rate;
                                return (
                                  <button
                                    key={rate}
                                    type="button"
                                    className={`registration-fee-choice${
                                      selected ? " is-selected" : ""
                                    }`}
                                    onClick={() =>
                                      updateMember(index, "registrationRate", rate)
                                    }
                                  >
                                    <span className="registration-fee-choice-tier">
                                      {tierLabel}
                                    </span>
                                    <span className="registration-fee-choice-amount">
                                      {formatPeso(amount)}
                                    </span>
                                    <span className="registration-fee-choice-meta">{meta}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {memberErrors[index]?.registrationRate ? (
                              <p className="mt-1 text-xs text-red-400">
                                {memberErrors[index]?.registrationRate}
                              </p>
                            ) : null}
                          </div>
                          {member.registrationRate === "seniorPwd" ? (
                            <FormField
                              label="Senior Citizen / PWD ID Number"
                              id={`member-${index}-seniorPwdIdNumber`}
                              required
                              value={member.seniorPwdIdNumber}
                              onChange={(v) => updateMember(index, "seniorPwdIdNumber", v)}
                              error={memberErrors[index]?.seniorPwdIdNumber}
                              className="col-12"
                            />
                          ) : null}
                          <SelectField
                            label="Food Preference"
                            id={`member-${index}-foodPreference`}
                            required
                            value={member.foodPreference}
                            onChange={(v) => updateMember(index, "foodPreference", v)}
                            options={FOOD_PREFERENCE_OPTIONS}
                            error={memberErrors[index]?.foodPreference}
                            placeholder="Select food preference"
                          />
                          {member.foodPreference === "allergy" ? (
                            <FormField
                              label="Food Allergy Note"
                              id={`member-${index}-foodAllergyNote`}
                              required
                              value={member.foodAllergyNote}
                              onChange={(v) => updateMember(index, "foodAllergyNote", v)}
                              error={memberErrors[index]?.foodAllergyNote}
                              className="col-12"
                            />
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  {1 + members.length < MAX_GROUP_SIZE ? (
                    <button type="button" className="registration-group-add-btn mt-3" onClick={addMember}>
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
                  <ReceiptSectionIcon />
                  Proof of Payment
                </legend>
                <p className="registration-form-help mb-3">
                  Pay using the QR code or bank transfer below, then upload your receipt or
                  screenshot. Proof of payment is required to complete registration.
                  {formData.registrationMode === "group"
                    ? " One payment and one receipt cover the whole group."
                    : ""}{" "}
                  Registration payments are subject to applicable Philippine tax documentation,
                  including BIR Form 2303 (Certificate of Registration) and BIR Form 2307
                  (Certificate of Creditable Tax Withheld at Source).
                </p>

                {feeLines.length > 0 ? (
                  <div className="registration-group-total mb-4">
                    {feeLines.map((line) => (
                      <div key={line.key} className="registration-group-total-row">
                        <span>
                          {line.name}
                          <span className="text-muted"> · {line.label}</span>
                        </span>
                        <strong>{formatPeso(line.amount)}</strong>
                      </div>
                    ))}
                    {formData.registrationMode === "group" ? (
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
                  <label htmlFor="receiptFile" className="form-label registration-form-label">
                    Upload Proof of Payment <span className="text-accent">*</span>
                    <span className="registration-form-optional"> (Image or PDF, max 10 MB)</span>
                  </label>
                  <input
                    id="receiptFile"
                    type="file"
                    accept="image/*,application/pdf"
                    className={`input-dark ${errors.receiptFile ? "input-dark-error" : ""}`}
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
                  {errors.receiptFile && (
                    <p className="mt-1 text-xs text-red-400">{errors.receiptFile}</p>
                  )}
                </div>

                {receiptFile ? (
                  <div className="col-12 mt-3 registration-payment-reference-panel">
                    <label htmlFor="paymentReference" className="form-label registration-form-label">
                      Payment / transfer reference <span className="text-accent">*</span>
                    </label>
                    <p className="registration-form-help mb-2">
                      We try to read this from your receipt. Please check it carefully and correct
                      it if needed.
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
                        Yes, this payment reference looks right (or I corrected it to match my
                        receipt).
                      </span>
                    </label>
                    {errors.paymentReference && (
                      <p className="mt-1 text-xs text-red-400">{errors.paymentReference}</p>
                    )}
                  </div>
                ) : null}
              </fieldset>

              <fieldset className="registration-form-section">
                <legend className="registration-form-legend">
                  <DocumentSectionIcon />
                  Tax Documents
                </legend>
                <div className="row g-3">
                  <FileField
                    label="Upload BIR Form 2303"
                    id="bir2303File"
                    required
                    accept="image/*,application/pdf"
                    hint="(Certificate of Registration, max 10 MB)"
                    file={bir2303File}
                    onChange={(file) =>
                      handleGenericFileSelected(file, "bir2303File", setBir2303File)
                    }
                    error={errors.bir2303File}
                  />
                  <FileField
                    label="Upload BIR Form 2307"
                    id="bir2307File"
                    accept="image/*,application/pdf"
                    hint="(Optional, Certificate of Creditable Tax Withheld, max 10 MB)"
                    file={bir2307File}
                    onChange={(file) =>
                      handleGenericFileSelected(file, "bir2307File", setBir2307File)
                    }
                    error={errors.bir2307File}
                  />
                </div>
              </fieldset>

              <fieldset className="registration-form-section">
                <legend className="registration-form-legend">
                  <ClipboardCheckSectionIcon />
                  Review & Consent
                </legend>
                <p className="form-label registration-form-label mb-2">
                  Do you consent to being acknowledged as a sponsor/delegate representing your
                  institution at this conference? <span className="text-accent">*</span>
                </p>
                <div className="registration-mode-toggle" role="group" aria-label="Sponsor consent">
                  <button
                    type="button"
                    className={`registration-mode-option${
                      formData.sponsorConsent === "yes" ? " is-selected" : ""
                    }`}
                    onClick={() => updateField("sponsorConsent", "yes")}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`registration-mode-option${
                      formData.sponsorConsent === "no" ? " is-selected" : ""
                    }`}
                    onClick={() => updateField("sponsorConsent", "no")}
                  >
                    No
                  </button>
                </div>
                {errors.sponsorConsent && (
                  <p className="mt-1 text-xs text-red-400">{errors.sponsorConsent}</p>
                )}
              </fieldset>

              <div className="registration-form-terms rounded-lg bg-white border border-green-100 p-3 p-md-4">
                <label className="d-flex align-items-start gap-3 mb-0 cursor-pointer">
                  <input
                    id="dataPrivacyConsent"
                    name="dataPrivacyConsent"
                    type="checkbox"
                    checked={formData.dataPrivacyConsent}
                    onChange={(e) => updateField("dataPrivacyConsent", e.target.checked)}
                    className="registration-form-checkbox mt-1"
                  />
                  <span className="small text-muted lh-base">
                    I hereby confirm that the information provided is accurate and complete. I
                    acknowledge the terms and conditions governing participation in the{" "}
                    {conference.conferenceName}, including the requirement for payment confirmation
                    prior to the event, and compliance with applicable Philippine tax documentation
                    such as BIR Form 2303 (Certificate of Registration) and BIR Form 2307
                    (Certificate of Creditable Tax Withheld at Source), where applicable. I consent
                    to the collection and processing of my personal data in accordance with the
                    Data Privacy Act of 2012 (Republic Act No. 10173).
                  </span>
                </label>
                {errors.dataPrivacyConsent && (
                  <p className="mt-2 mb-0 text-xs text-red-500 ps-4 ms-3">
                    {errors.dataPrivacyConsent}
                  </p>
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
                  mode: formData.registrationMode,
                  lastName: formData.lastName,
                  firstName: formData.firstName,
                  middleName: formData.middleName,
                  email: formData.email,
                  phone: formData.phone,
                  dateOfBirth: formData.dateOfBirth,
                  age: String(calculateAge(formData.dateOfBirth) ?? ""),
                  gender: formData.gender,
                  organization: formData.organization,
                  institutionAddress: formData.institutionAddress,
                  position: formData.position,
                  membershipType: formData.membershipType,
                  pnaIdNumber: formData.pnaIdNumber,
                  pnaZone: formData.pnaZone,
                  pnaChapter: formData.pnaChapter,
                  prcLicenseNumber: formData.prcLicenseNumber,
                  prcInitialRegistrationDate: formData.prcInitialRegistrationDate,
                  prcExpirationDate: formData.prcExpirationDate,
                  registrationMode: formData.registrationMode,
                  registrationRate: formData.registrationRate,
                  seniorPwdIdNumber: formData.seniorPwdIdNumber,
                  members: formData.registrationMode === "group" ? members : [],
                  foodPreference: formData.foodPreference,
                  foodAllergyNote: formData.foodAllergyNote,
                  sponsorConsent: formData.sponsorConsent,
                  dataPrivacyConsent: formData.dataPrivacyConsent,
                  paymentReference,
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
                disabled={loading || ocrStatus === "scanning"}
                className="registration-form-footer-btn registration-form-footer-btn--primary"
              >
                {loading
                  ? "Processing..."
                  : ocrStatus === "scanning"
                    ? "Scanning receipt..."
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

function IdCardSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="8.5" cy="11" r="1.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.8 15.2c.4-1.2 1.4-1.8 1.7-1.8s1.3.6 1.7 1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.5 10h5M13.5 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LicenseSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 9h8M8 12.5h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

function DocumentSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function ClipboardCheckSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.75" />
      <path d="m9 13 2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
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
  min,
  max,
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
  min?: string;
  max?: string;
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
        min={min}
        max={max}
        className={`input-dark ${error ? "input-dark-error" : ""}`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  id,
  required = false,
  value,
  onChange,
  options,
  error,
  placeholder,
  className = "col-12 col-md-6",
}: {
  label: string;
  id: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: PnaSelectOption[];
  error?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="form-label registration-form-label">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      <PnaSelect
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        required={required}
        className={error ? "pna-select--error" : ""}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function PhoneField({
  id,
  label = "Phone Number",
  required = true,
  value,
  onChange,
  onBlur,
  error,
  className = "col-12 col-md-6",
}: {
  id: string;
  label?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="form-label registration-form-label">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      <div className={`registration-phone-field${error ? " is-error" : ""}`}>
        <span className="registration-phone-prefix" aria-hidden="true">
          +63
        </span>
        <input
          type="tel"
          id={id}
          inputMode="numeric"
          autoComplete="tel-national"
          value={toPhMobileLocalDigits(value)}
          onChange={(e) => onChange(toPhMobileLocalDigits(e.target.value))}
          onBlur={onBlur}
          placeholder="9606207919"
          maxLength={10}
          className={`input-dark registration-phone-input${error ? " input-dark-error" : ""}`}
        />
      </div>
      <p className="registration-phone-hint mb-0">
        Enter 10 digits starting with 9 (do not include 0).
      </p>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function FileField({
  label,
  id,
  required = false,
  accept,
  hint,
  file,
  onChange,
  error,
  className = "col-12 col-md-6",
}: {
  label: string;
  id: string;
  required?: boolean;
  accept?: string;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="form-label registration-form-label">
        {label} {required && <span className="text-accent">*</span>}
        {hint ? <span className="registration-form-optional"> {hint}</span> : null}
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        className={`input-dark ${error ? "input-dark-error" : ""}`}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? <p className="mt-2 mb-0 text-xs text-muted">Selected: {file.name}</p> : null}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
