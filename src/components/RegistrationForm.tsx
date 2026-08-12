"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { conference, PNA_ZONES } from "@/lib/conference";
import { formatPeso, getEarlyBirdCap } from "@/lib/registration-fees";
import type {
  FoodPreference,
  MembershipType,
  RegistrationRateChoice,
  SpecialRole,
  SponsorConsent,
} from "@/lib/types/admin";
import { MEMBERSHIP_TYPE_LABELS, SPECIAL_ROLE_LABELS } from "@/lib/types/admin";
import {
  getDateOfBirthAgeValidationError,
  getEmailValidationError,
  getMaxDateOfBirthForMinAge,
  getNameLengthError,
  getRegistrationPhoneValidationError,
  calculateAgeFromDateOfBirth,
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
  cacheRegistrationFile,
  clearRegistrationCachedFiles,
  loadRegistrationCachedFiles,
} from "@/lib/registration-file-cache";
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
import { SingleDatePicker } from "@/components/ui/SingleDatePicker";
import { PhLocationSuggest } from "@/components/PhLocationSuggest";
import { RegistrationPaymentQr } from "@/components/RegistrationPaymentQr";
import type { RegistrationPaymentBreakdown } from "@/components/RegistrationSidebar";
import { FadeReveal } from "@/components/ui/FadeReveal";
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
  specialRole: SpecialRole | "";

  foodPreference: FoodPreference | "";
  foodAllergyNote: string;

  wantsSalesInvoice: "" | "yes" | "no";
  bir2303InstitutionName: string;
  receiptNamedUnder: string;
  /** Group + no sales invoice: "primary" | "member-0" | ... */
  receiptNamedParticipantKey: string;

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
  specialRole: "",

  foodPreference: "",
  foodAllergyNote: "",

  wantsSalesInvoice: "",
  bir2303InstitutionName: "",
  receiptNamedUnder: "",
  receiptNamedParticipantKey: "",

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
  { value: "lifetime", label: MEMBERSHIP_TYPE_LABELS.lifetime },
  { value: "regular", label: MEMBERSHIP_TYPE_LABELS.regular },
  { value: "renewal_member", label: MEMBERSHIP_TYPE_LABELS.renewal_member },
  { value: "non_member", label: MEMBERSHIP_TYPE_LABELS.non_member },
];

const PNA_MEMBERSHIP_RENEW_URL = "https://www.philippinernurses.org";

function isNonMemberType(type: MembershipType | "" | null | undefined): boolean {
  return type === "non_member";
}

const PNA_ZONE_OPTIONS: PnaSelectOption[] = [
  { value: "", label: "Select PNA zone/region" },
  ...PNA_ZONES.map((zone) => ({ value: zone, label: zone })),
];

const FOOD_PREFERENCE_OPTIONS: PnaSelectOption[] = [
  { value: "", label: "Select food preference" },
  { value: "regular", label: "Regular" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "no_pork", label: "No Pork" },
  { value: "allergy", label: "Food Allergy" },
];

function formatReceiptPersonName(
  firstName: string,
  middleName: string,
  lastName: string
): string {
  return [firstName, middleName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function calculateAge(dateOfBirth: string): number | null {
  return calculateAgeFromDateOfBirth(dateOfBirth);
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

function getPrcExpiredNote(expirationDate: string): string | undefined {
  if (!isExpiredDateInput(expirationDate)) return undefined;
  return "Note: PRC license is expired. You may still submit this registration.";
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
    case "dateOfBirth": {
      const ageError = getDateOfBirthAgeValidationError(data.dateOfBirth);
      return ageError ? ageError.replace(/\.$/, "") : undefined;
    }
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
      if (isNonMemberType(data.membershipType)) return undefined;
      return data.pnaIdNumber.trim() ? undefined : "PNA ID number is required";
    case "pnaZone":
      if (isNonMemberType(data.membershipType)) return undefined;
      return data.pnaZone ? undefined : "Please select a PNA zone/region";
    case "pnaChapter":
      if (isNonMemberType(data.membershipType)) return undefined;
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
      return undefined;
    case "registrationMode":
      return data.registrationMode ? undefined : "Please select a registration type";
    case "registrationRate":
      return data.registrationRate ? undefined : "Please choose your registration rate";
    case "specialRole":
      return data.specialRole ? undefined : "Please choose Committee or Speaker";
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
    case "wantsSalesInvoice":
      return data.wantsSalesInvoice ? undefined : "Please indicate whether you want a sales invoice";
    case "bir2303InstitutionName":
      if (data.wantsSalesInvoice !== "yes") return undefined;
      return data.bir2303InstitutionName.trim()
        ? undefined
        : "Institution / company name on BIR Form 2303 is required";
    case "receiptNamedUnder":
      if (data.wantsSalesInvoice === "yes") {
        return data.bir2303InstitutionName.trim() || data.receiptNamedUnder.trim()
          ? undefined
          : "Receipt name is taken from the BIR 2303 institution name";
      }
      if (data.registrationMode === "group") {
        return data.receiptNamedUnder.trim()
          ? undefined
          : "Please choose whose name should appear on the receipt";
      }
      return data.receiptNamedUnder.trim()
        ? undefined
        : "Receipt name is required";
    case "receiptNamedParticipantKey":
      if (data.wantsSalesInvoice === "yes" || data.registrationMode !== "group") return undefined;
      return data.receiptNamedParticipantKey
        ? undefined
        : "Please choose whose name should appear on the receipt";
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

const PAYMENT_FIELDS: FormFieldKey[] = [
  "registrationMode",
  "registrationRate",
  "foodPreference",
  "wantsSalesInvoice",
  "bir2303InstitutionName",
  "receiptNamedUnder",
  "receiptNamedParticipantKey",
];

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
  "membershipType",
  "pnaZone",
  "pnaChapter",
  "prcLicenseNumber",
  "prcInitialRegistrationDate",
  "prcExpirationDate",
  "registrationRate",
  "seniorPwdIdNumber",
  "foodPreference",
  "foodAllergyNote",
];

const DETAILS_SCROLL_TARGETS: string[] = [
  ...DETAILS_VALIDATE_FIELDS,
  "pnaIdFile",
  "prcIdFile",
];

const SPECIAL_LANE_SCROLL_TARGETS: string[] = [
  "specialRole",
  "foodPreference",
  "foodAllergyNote",
  "sponsorConsent",
  "dataPrivacyConsent-special",
];

function memberFieldDomId(index: number, field: keyof GroupMemberDraft): string {
  return `member-${index}-${String(field)}`;
}

function buildPaymentScrollTargets(
  registrationMode: RegistrationModeChoice | "",
  memberCount: number
): string[] {
  const targets: string[] = ["registrationMode"];
  if (registrationMode === "group") {
    targets.push("registration-group-members");
    for (let index = 0; index < memberCount; index += 1) {
      for (const field of MEMBER_VALIDATE_FIELDS) {
        targets.push(memberFieldDomId(index, field));
      }
    }
  }
  targets.push(
    "registrationRate",
    "seniorPwdIdNumber",
    "seniorPwdIdFile",
    "foodPreference",
    "foodAllergyNote",
    "receiptFile",
    "paymentReference",
    "wantsSalesInvoice",
    "bir2303File",
    "bir2303InstitutionName",
    "bir2307File",
    "receiptNamedParticipantKey",
    "sponsorConsent",
    "dataPrivacyConsent"
  );
  return targets;
}

function errorKeyForScrollTarget(target: string): string {
  if (target === "dataPrivacyConsent-special") return "dataPrivacyConsent";
  return target;
}

function findFirstRegistrationErrorTarget(
  orderedTargets: string[],
  errors: Errors,
  memberErrors: Record<number, Partial<Record<keyof GroupMemberDraft, string>>> = {}
): string | null {
  for (const target of orderedTargets) {
    if (target.startsWith("member-")) {
      const match = /^member-(\d+)-(.+)$/.exec(target);
      if (!match) continue;
      const index = Number(match[1]);
      const field = match[2] as keyof GroupMemberDraft;
      if (memberErrors[index]?.[field]) return target;
      continue;
    }
    if (errors[errorKeyForScrollTarget(target) as ErrorKey]) return target;
  }
  return null;
}

function scrollToRegistrationTarget(targetId: string) {
  window.requestAnimationFrame(() => {
    const el = document.getElementById(targetId);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    const focusable =
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLButtonElement
        ? el
        : el.querySelector<HTMLElement>("input, select, textarea, button");

    if (focusable instanceof HTMLElement) {
      focusable.focus({ preventScroll: true });
      return;
    }

    if (el instanceof HTMLElement) {
      el.tabIndex = -1;
      el.focus({ preventScroll: true });
    }
  });
}

function scrollToFirstRegistrationError(options: {
  orderedTargets: string[];
  errors: Errors;
  memberErrors?: Record<number, Partial<Record<keyof GroupMemberDraft, string>>>;
}) {
  const targetId = findFirstRegistrationErrorTarget(
    options.orderedTargets,
    options.errors,
    options.memberErrors ?? {}
  );
  if (targetId) scrollToRegistrationTarget(targetId);
}

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
    case "dateOfBirth": {
      const ageError = getDateOfBirthAgeValidationError(member.dateOfBirth);
      return ageError ? ageError.replace(/\.$/, "") : undefined;
    }
    case "membershipType":
      return member.membershipType ? undefined : "Please select a membership type";
    case "pnaZone":
      if (isNonMemberType(member.membershipType)) return undefined;
      return member.pnaZone ? undefined : "Please select a PNA zone/region";
    case "pnaChapter":
      if (isNonMemberType(member.membershipType)) return undefined;
      return member.pnaChapter.trim() ? undefined : "PNA chapter is required";
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
  phase: RegistrationFormPhase,
  specialLane: boolean
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
    const fields: FormFieldKey[] = isNonMemberType(data.membershipType)
      ? ["membershipType"]
      : MEMBERSHIP_FIELDS;
    const errs = fields.map((field) => getFieldError(field, data));
    const needsPnaIdFile = !isNonMemberType(data.membershipType);
    const fileOk = !needsPnaIdFile || Boolean(files.pnaIdFile);
    const isComplete = errs.every((error) => !error) && fileOk;
    const anyTouched =
      fields.some((field) => touched[field]) || (needsPnaIdFile && Boolean(files.pnaIdFile));
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
    if (specialLane) {
      const fields: FormFieldKey[] = ["specialRole", "foodPreference", ...REVIEW_FIELDS];
      if (data.foodPreference === "allergy") fields.push("foodAllergyNote");
      const errs = fields.map((field) => getFieldError(field, data));
      const isComplete = errs.every((error) => !error);
      const anyTouched = fields.some((field) => touched[field]);
      if (isComplete) return "complete";
      if (anyTouched) return "error";
      return "pending";
    }
    const fields: FormFieldKey[] = [...PAYMENT_FIELDS];
    if (data.registrationRate === "seniorPwd") fields.push("seniorPwdIdNumber");
    if (data.foodPreference === "allergy") fields.push("foodAllergyNote");
    const errs = fields.map((field) => getFieldError(field, data));
    const receiptOk = Boolean(files.receiptFile);
    const needsTaxDocs = data.wantsSalesInvoice === "yes";
    const bir2303Ok = !needsTaxDocs || Boolean(files.bir2303File);
    const bir2307Ok = !needsTaxDocs || Boolean(files.bir2307File);
    const refOk = paymentReference.trim().length >= 4 && referenceConfirmed;
    const membersOk = data.registrationMode !== "group" || membersValid;
    const isComplete =
      errs.every((error) => !error) &&
      receiptOk &&
      bir2303Ok &&
      bir2307Ok &&
      refOk &&
      membersOk;
    const anyTouched =
      PAYMENT_FIELDS.some((field) => touched[field]) ||
      receiptOk ||
      paymentReference.trim().length > 0 ||
      Boolean(files.bir2303File) ||
      Boolean(files.bir2307File);
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
  phase: RegistrationFormPhase,
  specialLane: boolean
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
      phase,
      specialLane
    ),
  }));

  let activeAssigned = false;
  return raw.map((step) => {
    if (phase === "details" && (step.label === "Payment" || step.label === "Review")) {
      return { ...step, status: "pending" as const };
    }
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
  inviteToken = null,
  inviteEmail = null,
  inviteFirstName = null,
  inviteSpecialRole = null,
  inviteEventTitle = null,
}: {
  onCompleted?: () => void;
  onBack?: () => void;
  onStepStatesChange?: (steps: RegistrationStepState[]) => void;
  onPaymentBreakdownChange?: (breakdown: RegistrationPaymentBreakdown | null) => void;
  className?: string;
  eventId?: string | null;
  inviteToken?: string | null;
  inviteEmail?: string | null;
  inviteFirstName?: string | null;
  inviteSpecialRole?: SpecialRole | null;
  inviteEventTitle?: string | null;
} = {}) {
  const specialLane = Boolean(inviteToken);
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
  const [bir2303OcrStatus, setBir2303OcrStatus] = useState<
    "idle" | "scanning" | "done" | "unavailable"
  >("idle");
  const [bir2303OcrMessage, setBir2303OcrMessage] = useState("");
  const [referenceConfirmed, setReferenceConfirmed] = useState(false);

  const [earlyBird, setEarlyBird] = useState<{
    mode: string;
    used: number;
    cap: number | null;
    remaining: number | null;
    available: boolean;
    seniorPwdAvailable: boolean;
    caption: string;
    earlyBirdAmount: number;
    regularAmount: number;
    seniorPwdAmount: number;
    nonMemberAmount: number;
  } | null>(null);

  const [successDetails, setSuccessDetails] = useState<RegistrationSuccessDetails | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);

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
  /** Senior/PWD mirrors early bird amount and is only offered after early bird ends. */
  const seniorPwdAmount = earlyBird?.seniorPwdAmount ?? earlyBirdAmount;
  const nonMemberAmount = earlyBird?.nonMemberAmount ?? fallbackFees.nonMember.amount;
  const earlyBirdAvailable =
    earlyBird?.available ??
    (typeof earlyBird?.remaining === "number" ? earlyBird.remaining > 0 : true);
  const seniorPwdAvailable = earlyBird?.seniorPwdAvailable ?? !earlyBirdAvailable;
  const rateOptions = (
    seniorPwdAvailable ? (["regular", "seniorPwd"] as const) : (["regular"] as const)
  );

  useEffect(() => {
    if (!earlyBirdAvailable) return;
    setFormData((prev) =>
      prev.registrationRate === "seniorPwd"
        ? { ...prev, registrationRate: "regular", seniorPwdIdNumber: "" }
        : prev
    );
    setMembers((prev) =>
      prev.map((member) =>
        member.registrationRate === "seniorPwd"
          ? { ...member, registrationRate: "regular", seniorPwdIdNumber: "" }
          : member
      )
    );
  }, [earlyBirdAvailable]);

  useEffect(() => {
    setMembers((prev) => {
      let changed = false;
      const next = prev.map((member) => {
        if (!member.sameAffiliationAsPrimary) return member;
        if (
          member.membershipType === formData.membershipType &&
          member.pnaZone === formData.pnaZone &&
          member.pnaChapter === formData.pnaChapter
        ) {
          return member;
        }
        changed = true;
        return {
          ...member,
          membershipType: formData.membershipType,
          pnaZone: formData.pnaZone,
          pnaChapter: formData.pnaChapter,
        };
      });
      return changed ? next : prev;
    });
  }, [formData.membershipType, formData.pnaZone, formData.pnaChapter]);

  const appliedFee = useMemo(() => {
    if (!formData.registrationRate) return null;
    if (isNonMemberType(formData.membershipType)) {
      if (formData.registrationRate === "seniorPwd" && seniorPwdAvailable) {
        return { amount: seniorPwdAmount, label: fallbackFees.seniorPwd.label };
      }
      return { amount: nonMemberAmount, label: fallbackFees.nonMember.label };
    }
    if (formData.registrationRate === "seniorPwd" && seniorPwdAvailable) {
      return { amount: seniorPwdAmount, label: fallbackFees.seniorPwd.label };
    }
    if (earlyBirdAvailable) {
      return { amount: earlyBirdAmount, label: fallbackFees.earlyBird.label };
    }
    return { amount: regularAmount, label: fallbackFees.regular.label };
  }, [
    formData.registrationRate,
    formData.membershipType,
    earlyBirdAvailable,
    seniorPwdAvailable,
    earlyBirdAmount,
    regularAmount,
    seniorPwdAmount,
    nonMemberAmount,
    fallbackFees,
  ]);

  const feeLines = useMemo(() => {
    const lines: { key: string; name: string; label: string; amount: number }[] = [];
    let earlyUsed = 0;
    const slotRemaining =
      typeof earlyBird?.remaining === "number"
        ? earlyBird.remaining
        : getEarlyBirdCap(fallbackFees);

    const resolveLine = (
      rate: RegistrationRateChoice | "",
      name: string,
      key: string,
      membershipType: MembershipType | ""
    ) => {
      if (!rate) return;
      if (isNonMemberType(membershipType)) {
        if (rate === "seniorPwd" && seniorPwdAvailable) {
          lines.push({
            key,
            name,
            label: fallbackFees.seniorPwd.label,
            amount: seniorPwdAmount,
          });
          return;
        }
        lines.push({
          key,
          name,
          label: fallbackFees.nonMember.label,
          amount: nonMemberAmount,
        });
        return;
      }
      if (rate === "seniorPwd" && seniorPwdAvailable) {
        lines.push({
          key,
          name,
          label: fallbackFees.seniorPwd.label,
          amount: seniorPwdAmount,
        });
        return;
      }

      const qualifiesForEarlyBird =
        earlyBirdAvailable && slotRemaining - earlyUsed > 0;

      if (qualifiesForEarlyBird) {
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
      "primary",
      formData.membershipType
    );

    if (formData.registrationMode === "group") {
      members.forEach((member, index) => {
        resolveLine(
          member.registrationRate,
          member.firstName.trim() || `Participant ${index + 2}`,
          `member-${index}`,
          member.membershipType
        );
      });
    }

    return lines;
  }, [
    formData.registrationRate,
    formData.membershipType,
    formData.firstName,
    formData.registrationMode,
    members,
    earlyBirdAvailable,
    seniorPwdAvailable,
    earlyBird?.remaining,
    earlyBirdAmount,
    regularAmount,
    seniorPwdAmount,
    nonMemberAmount,
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
        registrationMode: specialLane ? "single" : draft.registrationMode,
        registrationRate: draft.registrationRate,
        seniorPwdIdNumber: draft.seniorPwdIdNumber,
        specialRole: "",
        foodPreference: draft.foodPreference,
        foodAllergyNote: draft.foodAllergyNote,
        wantsSalesInvoice: draft.wantsSalesInvoice ?? "",
        bir2303InstitutionName: draft.bir2303InstitutionName ?? "",
        receiptNamedUnder: draft.receiptNamedUnder ?? "",
        receiptNamedParticipantKey: draft.receiptNamedParticipantKey ?? "",
        sponsorConsent: draft.sponsorConsent,
        dataPrivacyConsent: draft.dataPrivacyConsent,
      });
      setMembers(
        specialLane
          ? []
          : draft.registrationMode === "group"
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

    let cancelled = false;
    void loadRegistrationCachedFiles(eventId).then((cached) => {
      if (cancelled) return;
      if (cached.pnaIdFile) setPnaIdFile(cached.pnaIdFile);
      if (cached.prcIdFile) setPrcIdFile(cached.prcIdFile);
      if (cached.seniorPwdIdFile) setSeniorPwdIdFile(cached.seniorPwdIdFile);
      if (cached.receiptFile) setReceiptFile(cached.receiptFile);
      if (cached.bir2303File) setBir2303File(cached.bir2303File);
      if (cached.bir2307File) setBir2307File(cached.bir2307File);
      if (cached.receiptFile) setReferenceConfirmed(false);
    });

    return () => {
      cancelled = true;
    };
  }, [eventId, specialLane]);

  useEffect(() => {
    if (!specialLane || !inviteEmail) return;
    setFormData((prev) => ({
      ...prev,
      email: inviteEmail,
      firstName: inviteFirstName?.trim() || prev.firstName,
      specialRole: inviteSpecialRole || prev.specialRole,
      registrationMode: "single",
    }));
    setMembers([]);
  }, [specialLane, inviteEmail, inviteFirstName, inviteSpecialRole]);

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
        wantsSalesInvoice: formData.wantsSalesInvoice,
        bir2303InstitutionName: formData.bir2303InstitutionName,
        receiptNamedUnder: formData.receiptNamedUnder,
        receiptNamedParticipantKey: formData.receiptNamedParticipantKey,
      });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [draftLoaded, eventId, formData, members, paymentReference]);

  useEffect(() => {
    if (specialLane || formData.wantsSalesInvoice === "yes") return;
    if (formData.registrationMode !== "single") return;
    const name = formatReceiptPersonName(
      formData.firstName,
      formData.middleName,
      formData.lastName
    );
    setFormData((prev) =>
      prev.receiptNamedUnder === name ? prev : { ...prev, receiptNamedUnder: name }
    );
  }, [
    specialLane,
    formData.wantsSalesInvoice,
    formData.registrationMode,
    formData.firstName,
    formData.middleName,
    formData.lastName,
  ]);

  useEffect(() => {
    if (specialLane || formData.wantsSalesInvoice === "yes") return;
    if (formData.registrationMode !== "group") return;
    const key = formData.receiptNamedParticipantKey;
    if (!key) return;
    let name = "";
    if (key === "primary") {
      name = formatReceiptPersonName(
        formData.firstName,
        formData.middleName,
        formData.lastName
      );
    } else if (key.startsWith("member-")) {
      const index = Number(key.slice("member-".length));
      const member = members[index];
      if (member) {
        name = formatReceiptPersonName(member.firstName, member.middleName, member.lastName);
      }
    }
    if (!name) return;
    setFormData((prev) =>
      prev.receiptNamedUnder === name ? prev : { ...prev, receiptNamedUnder: name }
    );
  }, [
    specialLane,
    formData.wantsSalesInvoice,
    formData.registrationMode,
    formData.receiptNamedParticipantKey,
    formData.firstName,
    formData.middleName,
    formData.lastName,
    members,
  ]);

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
        formPhase,
        specialLane
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
    specialLane,
    onStepStatesChange,
  ]);

  useEffect(() => {
    if (formPhase !== "payment") return;
    if (specialLane) return;
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
  }, [formPhase, eventId, specialLane]);

  useEffect(() => {
    if (!onPaymentBreakdownChange) return;

    if (formPhase !== "payment") {
      onPaymentBreakdownChange(null);
      return;
    }

    if (specialLane) {
      const roleLabel =
        formData.specialRole && formData.specialRole in SPECIAL_ROLE_LABELS
          ? SPECIAL_ROLE_LABELS[formData.specialRole]
          : "Complimentary invite";
      onPaymentBreakdownChange({
        categoryLabel: "Special invite",
        feeTierLabel: roleLabel,
        unitFee: 0,
        headcount: 1,
        totalFee: 0,
      });
      return;
    }

    if (!appliedFee) {
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
    formData.specialRole,
    headcount,
    totalFee,
    unitFee,
    specialLane,
    onPaymentBreakdownChange,
  ]);

  function validateMembers(): {
    ok: boolean;
    memberErrors: Record<number, Partial<Record<keyof GroupMemberDraft, string>>>;
    membersMessage?: string;
  } {
    if (formData.registrationMode !== "group") {
      setMemberErrors({});
      setErrors((prev) => {
        const next = { ...prev };
        delete next.members;
        return next;
      });
      return { ok: true, memberErrors: {} };
    }

    if (members.length < 1) {
      const membersMessage = "Add at least one additional participant sharing this payment.";
      setErrors((prev) => ({
        ...prev,
        members: membersMessage,
      }));
      return { ok: false, memberErrors: {}, membersMessage };
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

    const membersMessage = ok
      ? undefined
      : "Please fix the additional participant details.";

    setMemberErrors(nextMemberErrors);
    setErrors((prev) => {
      const next = { ...prev };
      if (ok) delete next.members;
      else next.members = membersMessage;
      return next;
    });
    return { ok, memberErrors: nextMemberErrors, membersMessage };
  }

  function validateDetails(): boolean {
    const newErrors: Errors = {};
    const allTouched: Partial<Record<FormFieldKey, boolean>> = { ...touched };

    for (const field of DETAILS_VALIDATE_FIELDS) {
      allTouched[field] = true;
      const error = getFieldError(field, formData);
      if (error) newErrors[field] = error;
    }

    if (!isNonMemberType(formData.membershipType) && !pnaIdFile) {
      newErrors.pnaIdFile = "Please upload a copy of your PNA ID.";
    }
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

    const ok = Object.keys(newErrors).length === 0;
    if (!ok) {
      scrollToFirstRegistrationError({
        orderedTargets: DETAILS_SCROLL_TARGETS,
        errors: newErrors,
      });
    }
    return ok;
  }

  function validatePayment(): boolean {
    const newErrors: Errors = {};
    const allTouched: Partial<Record<FormFieldKey, boolean>> = { ...touched };

    if (specialLane) {
      const fieldsToCheck: FormFieldKey[] = [
        "specialRole",
        "foodPreference",
        ...REVIEW_FIELDS,
      ];
      if (formData.foodPreference === "allergy") fieldsToCheck.push("foodAllergyNote");

      for (const field of fieldsToCheck) {
        allTouched[field] = true;
        const error = getFieldError(field, formData);
        if (error) newErrors[field] = error;
      }

      setTouched(allTouched);
      setErrors((prev) => {
        const next: Errors = { ...prev };
        for (const field of fieldsToCheck) {
          if (newErrors[field]) next[field] = newErrors[field];
          else delete next[field];
        }
        delete next.receiptFile;
        delete next.bir2303File;
        delete next.bir2307File;
        delete next.paymentReference;
        delete next.members;
        delete next.registrationRate;
        delete next.registrationMode;
        return next;
      });

      const ok = Object.keys(newErrors).length === 0;
      if (!ok) {
        scrollToFirstRegistrationError({
          orderedTargets: SPECIAL_LANE_SCROLL_TARGETS,
          errors: newErrors,
        });
      }
      return ok;
    }

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

    if (formData.wantsSalesInvoice === "yes") {
      if (!bir2303File) {
        newErrors.bir2303File = "BIR Form 2303 (Certificate of Registration) is required.";
      }
      if (!bir2307File) {
        newErrors.bir2307File =
          "BIR Form 2307 (Certificate of Creditable Tax Withheld) is required.";
      }
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

    const membersValidation = validateMembers();

    setTouched(allTouched);
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
      if (newErrors.bir2307File) next.bir2307File = newErrors.bir2307File;
      else delete next.bir2307File;
      if (newErrors.paymentReference) next.paymentReference = newErrors.paymentReference;
      else delete next.paymentReference;
      return next;
    });

    const scrollErrors: Errors = { ...newErrors };
    if (membersValidation.membersMessage) {
      scrollErrors.members = membersValidation.membersMessage;
    }

    const ok =
      Object.keys(newErrors).length === 0 && membersValidation.ok;
    if (!ok) {
      scrollToFirstRegistrationError({
        orderedTargets: buildPaymentScrollTargets(formData.registrationMode, members.length),
        errors: scrollErrors,
        memberErrors: membersValidation.memberErrors,
      });
    }
    return ok;
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
    key: "pnaIdFile" | "prcIdFile" | "seniorPwdIdFile" | "bir2307File",
    setFile: (file: File | null) => void
  ) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    if (!file) {
      setFile(null);
      cacheRegistrationFile(eventId, key, null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({ ...prev, [key]: "File must be 10 MB or smaller." }));
      setFile(null);
      cacheRegistrationFile(eventId, key, null);
      return;
    }

    setFile(file);
    cacheRegistrationFile(eventId, key, file);
  }

  async function handleBir2303Selected(file: File | null) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next.bir2303File;
      delete next.bir2303InstitutionName;
      return next;
    });

    if (!file) {
      setBir2303File(null);
      cacheRegistrationFile(eventId, "bir2303File", null);
      setBir2303OcrStatus("idle");
      setBir2303OcrMessage("");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({
        ...prev,
        bir2303File: "File must be 10 MB or smaller.",
      }));
      setBir2303File(null);
      cacheRegistrationFile(eventId, "bir2303File", null);
      return;
    }

    setBir2303File(file);
    cacheRegistrationFile(eventId, "bir2303File", file);
    setBir2303OcrMessage("");
    setBir2303OcrStatus("idle");

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setBir2303OcrStatus("unavailable");
      setBir2303OcrMessage(
        "PDF uploaded. Please type the institution / company name as shown on BIR Form 2303."
      );
      return;
    }

    if (!file.type.startsWith("image/")) {
      setBir2303OcrStatus("unavailable");
      setBir2303OcrMessage(
        "Please type the institution / company name as shown on BIR Form 2303."
      );
      return;
    }

    setBir2303OcrStatus("scanning");
    try {
      const { scanBir2303Image } = await import("@/lib/bir2303-ocr");
      const result = await scanBir2303Image(file);
      setBir2303OcrStatus("done");
      if (result.best) {
        setFormData((prev) => ({
          ...prev,
          bir2303InstitutionName: result.best,
          receiptNamedUnder:
            prev.wantsSalesInvoice === "yes" ? result.best : prev.receiptNamedUnder,
        }));
        setTouched((prev) => ({ ...prev, bir2303InstitutionName: true }));
        setBir2303OcrMessage(
          result.fromCache
            ? "Using a saved scan of this BIR Form 2303. Please confirm the institution name."
            : "We read this institution / company name from your BIR Form 2303. Please check it and edit if needed."
        );
      } else {
        setBir2303OcrMessage(
          "We could not read a clear institution name. Please type it exactly as shown on BIR Form 2303."
        );
      }
    } catch {
      setBir2303OcrStatus("unavailable");
      setBir2303OcrMessage(
        "Could not scan this image. Please type the institution / company name from BIR Form 2303."
      );
    }
  }

  async function handleReceiptSelected(file: File | null) {
    setReceiptFile(file);
    cacheRegistrationFile(eventId, "receiptFile", file);
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
      cacheRegistrationFile(eventId, "receiptFile", null);
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
          result.fromCache
            ? "Using a saved scan of this receipt. Please confirm the payment reference."
            : "We found a payment reference on your receipt. Does this look right? Edit it if needed, then confirm below."
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
    setBir2303OcrStatus("idle");
    setBir2303OcrMessage("");
    setReferenceConfirmed(false);
    setErrors({});
    setMemberErrors({});
    setTouched({});
    setFormPhase("details");
    setEarlyBird(null);
    void clearRegistrationCachedFiles(eventId);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (formPhase !== "payment") {
      handleContinueToPayment();
      return;
    }

    if (!validatePayment()) return;

    const isGroup = !specialLane && formData.registrationMode === "group";
    requestConfirm({
      title: "Submit registration?",
      message: specialLane
        ? "Submit your complimentary Committee/Speaker registration? This exclusive invite link can only be used once."
        : isGroup
          ? `Submit group registration for ${headcount} participants with one combined payment of ${formatPeso(totalFee)}? Each person will receive their own reference number by email.`
          : "Are you sure you want to submit your official registration? Please confirm your details are correct before continuing.",
      confirmLabel: "Submit registration",
      loadingMessage: specialLane
        ? "Submitting complimentary registration..."
        : "Submitting registration and uploading documents...",
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
            pnaIdNumber: isNonMemberType(formData.membershipType)
              ? ""
              : formData.pnaIdNumber.trim(),
            pnaZone: isNonMemberType(formData.membershipType) ? "" : formData.pnaZone,
            pnaChapter: isNonMemberType(formData.membershipType)
              ? ""
              : formData.pnaChapter.trim(),
            prcLicenseNumber: formData.prcLicenseNumber.trim(),
            prcInitialRegistrationDate: formData.prcInitialRegistrationDate,
            prcExpirationDate: formData.prcExpirationDate,
            registrationMode: "single" as const,
            registrationRate: (specialLane
              ? "regular"
              : formData.registrationRate) as RegistrationRateChoice,
            seniorPwdIdNumber:
              !specialLane && formData.registrationRate === "seniorPwd"
                ? formData.seniorPwdIdNumber.trim()
                : undefined,
            foodPreference: formData.foodPreference as FoodPreference,
            foodAllergyNote: formData.foodAllergyNote.trim() || undefined,
            sponsorConsent: formData.sponsorConsent as SponsorConsent,
            dataPrivacyConsent: formData.dataPrivacyConsent,
            paymentReference: specialLane ? "" : paymentReference.trim(),
            wantsSalesInvoice: specialLane ? false : formData.wantsSalesInvoice === "yes",
            bir2303InstitutionName:
              !specialLane && formData.wantsSalesInvoice === "yes"
                ? formData.bir2303InstitutionName.trim()
                : "",
            receiptNamedUnder: specialLane
              ? ""
              : formData.wantsSalesInvoice === "yes"
                ? formData.bir2303InstitutionName.trim()
                : formData.receiptNamedUnder.trim(),
            eventId,
            inviteToken: specialLane ? inviteToken ?? undefined : undefined,
            specialRole: specialLane
              ? (formData.specialRole as SpecialRole)
              : undefined,
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
              primary: { ...primaryPayload, registrationMode: "group" },
              members: members.map((member) => ({
                firstName: member.firstName.trim(),
                lastName: member.lastName.trim(),
                middleName: member.middleName.trim(),
                email: member.email.trim(),
                phone: toPhMobileInternational(member.phone) ?? member.phone,
                dateOfBirth: member.dateOfBirth,
                membershipType: member.membershipType as MembershipType,
                pnaZone: isNonMemberType(member.membershipType) ? "" : member.pnaZone,
                pnaChapter: isNonMemberType(member.membershipType)
                  ? ""
                  : member.pnaChapter.trim(),
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
          if (!specialLane) {
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
          }

          try {
            await submitRegistrationDocuments({
              referenceNumber: registration.referenceNumber,
              email: formData.email.trim(),
              pnaId: isNonMemberType(formData.membershipType) ? null : pnaIdFile,
              prcId: prcIdFile,
              bir2303:
                !specialLane && formData.wantsSalesInvoice === "yes" ? bir2303File : null,
              bir2307:
                !specialLane && formData.wantsSalesInvoice === "yes" ? bir2307File : null,
              seniorPwdId:
                !specialLane && formData.registrationRate === "seniorPwd"
                  ? seniorPwdIdFile
                  : null,
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
            category:
              registration.feeLabel ||
              (specialLane && formData.specialRole
                ? SPECIAL_ROLE_LABELS[formData.specialRole]
                : feeSummaryLabel) ||
              "Conference Registration",
            receiptUploaded,
            receiptUploadFailed,
            groupSize: groupMeta?.groupSize,
            totalPaymentAmount: groupMeta?.totalPaymentAmount ?? (specialLane ? 0 : totalFee),
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
          void clearRegistrationCachedFiles(eventId);
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

  function updateField<K extends FormFieldKey>(field: K, value: FormData[K]) {
    setFormData((prev) => {
      if (field === "membershipType") {
        const membershipType = value as MembershipType | "";
        if (isNonMemberType(membershipType)) {
          setPnaIdFile(null);
          cacheRegistrationFile(eventId, "pnaIdFile", null);
          return {
            ...prev,
            membershipType,
            pnaIdNumber: "",
            pnaZone: "",
            pnaChapter: "",
          };
        }
      }
      if (field === "wantsSalesInvoice") {
        const wantsSalesInvoice = value as "" | "yes" | "no";
        if (wantsSalesInvoice !== "yes") {
          setBir2303File(null);
          setBir2307File(null);
          cacheRegistrationFile(eventId, "bir2303File", null);
          cacheRegistrationFile(eventId, "bir2307File", null);
          setBir2303OcrStatus("idle");
          setBir2303OcrMessage("");
          return {
            ...prev,
            wantsSalesInvoice,
            bir2303InstitutionName: "",
            receiptNamedParticipantKey:
              wantsSalesInvoice === "no" && prev.registrationMode === "group"
                ? prev.receiptNamedParticipantKey
                : "",
            receiptNamedUnder:
              wantsSalesInvoice === "no" && prev.registrationMode === "single"
                ? formatReceiptPersonName(prev.firstName, prev.middleName, prev.lastName)
                : wantsSalesInvoice === "no"
                  ? prev.receiptNamedUnder
                  : "",
          };
        }
        return {
          ...prev,
          wantsSalesInvoice,
          receiptNamedParticipantKey: "",
          receiptNamedUnder: prev.bir2303InstitutionName.trim(),
        };
      }
      if (field === "bir2303InstitutionName") {
        const bir2303InstitutionName = String(value);
        return {
          ...prev,
          bir2303InstitutionName,
          receiptNamedUnder:
            prev.wantsSalesInvoice === "yes"
              ? bir2303InstitutionName.trim()
              : prev.receiptNamedUnder,
        };
      }
      if (field === "receiptNamedParticipantKey") {
        const key = String(value);
        let receiptNamedUnder = prev.receiptNamedUnder;
        if (key === "primary") {
          receiptNamedUnder = formatReceiptPersonName(
            prev.firstName,
            prev.middleName,
            prev.lastName
          );
        } else if (key.startsWith("member-")) {
          const index = Number(key.slice("member-".length));
          const member = members[index];
          if (member) {
            receiptNamedUnder = formatReceiptPersonName(
              member.firstName,
              member.middleName,
              member.lastName
            );
          }
        }
        return { ...prev, receiptNamedParticipantKey: key, receiptNamedUnder };
      }
      return { ...prev, [field]: value };
    });
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function setRegistrationMode(mode: RegistrationMode) {
    setFormData((prev) => ({
      ...prev,
      registrationMode: mode,
      receiptNamedParticipantKey: "",
      receiptNamedUnder:
        mode === "single" && prev.wantsSalesInvoice !== "yes"
          ? formatReceiptPersonName(prev.firstName, prev.middleName, prev.lastName)
          : prev.wantsSalesInvoice === "yes"
            ? prev.bir2303InstitutionName.trim()
            : "",
    }));
    setTouched((prev) => ({ ...prev, registrationMode: true }));
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
        if (field === "membershipType") {
          const membershipType =
            value === "lifetime" ||
            value === "regular" ||
            value === "renewal_member" ||
            value === "non_member"
              ? value
              : ("" as const);
          return {
            ...member,
            membershipType,
            pnaZone: isNonMemberType(membershipType) ? "" : member.pnaZone,
            pnaChapter: isNonMemberType(membershipType) ? "" : member.pnaChapter,
            sameAffiliationAsPrimary: false,
          };
        }
        if (field === "pnaZone" || field === "pnaChapter") {
          return { ...member, [field]: value, sameAffiliationAsPrimary: false };
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

  function setMemberSameAffiliation(index: number, checked: boolean) {
    setMembers((prev) =>
      prev.map((member, i) => {
        if (i !== index) return member;
        if (!checked) {
          return { ...member, sameAffiliationAsPrimary: false };
        }
        return {
          ...member,
          sameAffiliationAsPrimary: true,
          membershipType: formData.membershipType,
          pnaZone: formData.pnaZone,
          pnaChapter: formData.pnaChapter,
        };
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

        <form
          id="registration-form"
          onSubmit={handleSubmit}
          className={`registration-form ${className}`.trim()}
          noValidate
        >
          {specialLane ? (
            <div className="registration-special-invite-banner mb-3">
              <p className="mb-1 fw-semibold">Exclusive complimentary registration</p>
              <p className="mb-0 small text-muted">
                You are registering via a one-time invite
                {inviteEventTitle ? ` for ${inviteEventTitle}` : ""}. Choose Committee or Speaker
                on the next step — no payment is required.
              </p>
            </div>
          ) : null}
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
                    disabled={specialLane}
                  />
                  <PhoneField
                    id="phone"
                    value={formData.phone}
                    onChange={(v) => updateField("phone", v)}
                    onBlur={() => markFieldTouched("phone")}
                    error={errors.phone}
                  />
                  <SingleDatePicker
                    label="Date of Birth"
                    id="dateOfBirth"
                    required
                    value={formData.dateOfBirth}
                    onChange={(v) => updateField("dateOfBirth", v)}
                    onBlur={() => markFieldTouched("dateOfBirth")}
                    error={errors.dateOfBirth}
                    max={getMaxDateOfBirthForMinAge()}
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
                  <PhLocationSuggest
                    label="Institution Address"
                    id="institutionAddress"
                    type="street"
                    required
                    value={formData.institutionAddress}
                    onChange={(v) => updateField("institutionAddress", v)}
                    onSelect={(suggestion) => updateField("institutionAddress", suggestion.label)}
                    onBlur={() => markFieldTouched("institutionAddress")}
                    error={errors.institutionAddress}
                    placeholder="Start typing a Philippines address"
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
                <div className="registration-membership-grid">
                  <div className="registration-membership-cell">
                    <SelectField
                      label="Membership Type"
                      id="membershipType"
                      required
                      value={formData.membershipType}
                      onChange={(v) => updateField("membershipType", v as MembershipType | "")}
                      options={MEMBERSHIP_TYPE_OPTIONS}
                      error={errors.membershipType}
                      placeholder="Select membership type"
                      className=""
                    />
                    <FadeReveal
                      show={formData.membershipType === "renewal_member"}
                      className="registration-fade-reveal--flush registration-fade-reveal--tight"
                    >
                      <p className="registration-membership-notice mb-0" role="status">
                        We encourage you to renew your PNA membership at{" "}
                        <a
                          href={PNA_MEMBERSHIP_RENEW_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          www.philippinernurses.org
                        </a>
                        .
                      </p>
                    </FadeReveal>
                  </div>
                  <FadeReveal
                    show={
                      !isNonMemberType(formData.membershipType) &&
                      Boolean(formData.membershipType)
                    }
                    className="registration-membership-cell registration-fade-reveal--flush"
                  >
                    <FormField
                      label="PNA ID Number"
                      id="pnaIdNumber"
                      required
                      value={formData.pnaIdNumber}
                      onChange={(v) => updateField("pnaIdNumber", v)}
                      onBlur={() => markFieldTouched("pnaIdNumber")}
                      error={errors.pnaIdNumber}
                      className=""
                    />
                  </FadeReveal>
                  <FadeReveal
                    show={
                      !isNonMemberType(formData.membershipType) &&
                      Boolean(formData.membershipType)
                    }
                    className="registration-membership-cell registration-fade-reveal--flush"
                  >
                    <SelectField
                      label="PNA Zone/Region"
                      id="pnaZone"
                      required
                      value={formData.pnaZone}
                      onChange={(v) => updateField("pnaZone", v)}
                      options={PNA_ZONE_OPTIONS}
                      error={errors.pnaZone}
                      placeholder="Select PNA zone/region"
                      searchable
                      searchPlaceholder="Search zone/region..."
                      className=""
                    />
                  </FadeReveal>
                  <FadeReveal
                    show={
                      !isNonMemberType(formData.membershipType) &&
                      Boolean(formData.membershipType)
                    }
                    className="registration-membership-cell registration-fade-reveal--flush"
                  >
                    <FormField
                      label="PNA Chapter (For Local and Foreign based)"
                      id="pnaChapter"
                      required
                      value={formData.pnaChapter}
                      onChange={(v) => updateField("pnaChapter", v)}
                      onBlur={() => markFieldTouched("pnaChapter")}
                      error={errors.pnaChapter}
                      className=""
                    />
                  </FadeReveal>
                </div>
                <FadeReveal
                  show={
                    !isNonMemberType(formData.membershipType) &&
                    Boolean(formData.membershipType)
                  }
                  className="registration-fade-reveal--flush mt-3"
                >
                  <FileField
                    label="Upload PNA ID"
                    id="pnaIdFile"
                    required
                    accept="image/*"
                    hint="(Image, max 10 MB)"
                    file={pnaIdFile}
                    onChange={(file) =>
                      handleGenericFileSelected(file, "pnaIdFile", setPnaIdFile)
                    }
                    error={errors.pnaIdFile}
                    className=""
                  />
                </FadeReveal>
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
                  <SingleDatePicker
                    label="Initial Registration Date"
                    id="prcInitialRegistrationDate"
                    required
                    value={formData.prcInitialRegistrationDate}
                    onChange={(v) => updateField("prcInitialRegistrationDate", v)}
                    onBlur={() => markFieldTouched("prcInitialRegistrationDate")}
                    error={errors.prcInitialRegistrationDate}
                    max={getTodayDateInput()}
                  />
                  <SingleDatePicker
                    label="Expiration Date"
                    id="prcExpirationDate"
                    required
                    value={formData.prcExpirationDate}
                    onChange={(v) => updateField("prcExpirationDate", v)}
                    onBlur={() => markFieldTouched("prcExpirationDate")}
                    error={errors.prcExpirationDate}
                    helpText={getPrcExpiredNote(formData.prcExpirationDate)}
                    min={formData.prcInitialRegistrationDate || undefined}
                    placement="top"
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
          ) : specialLane ? (
            <>
              <fieldset className="registration-form-section">
                <legend className="registration-form-legend">
                  <UsersSectionIcon />
                  Participation role
                </legend>
                <p className="registration-form-help mb-3">
                  {inviteSpecialRole
                    ? `This exclusive invite is assigned to you as ${
                        inviteSpecialRole === "committee" ? "Committee" : "Guest Speaker"
                      }. Registration is complimentary.`
                    : "Select whether you are registering as Committee or Speaker. Both are complimentary."}
                </p>
                <div className="registration-mode-toggle" id="specialRole" role="group" aria-label="Special role">
                  {inviteSpecialRole ? (
                    <button type="button" className="registration-mode-option is-selected" disabled>
                      {inviteSpecialRole === "committee" ? "Committee" : "Guest Speaker"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`registration-mode-option${
                          formData.specialRole === "committee" ? " is-selected" : ""
                        }`}
                        onClick={() => updateField("specialRole", "committee")}
                      >
                        Committee
                      </button>
                      <button
                        type="button"
                        className={`registration-mode-option${
                          formData.specialRole === "speaker" ? " is-selected" : ""
                        }`}
                        onClick={() => updateField("specialRole", "speaker")}
                      >
                        Speaker
                      </button>
                    </>
                  )}
                </div>
                {errors.specialRole ? (
                  <p className="mt-1 text-xs text-red-400">{errors.specialRole}</p>
                ) : null}
              </fieldset>

              <fieldset className="registration-form-section">
                <legend className="registration-form-legend">
                  <UserSectionIcon />
                  Preferences
                </legend>
                <div className="row g-3">
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

              <fieldset className="registration-form-section">
                <legend className="registration-form-legend">
                  <ClipboardCheckSectionIcon />
                  Review & Consent
                </legend>
                <p className="form-label registration-form-label mb-2">
                  Do you consent to being acknowledged as a sponsor/delegate representing your
                  institution at this conference? <span className="text-accent">*</span>
                </p>
                <div
                  id="sponsorConsent"
                  className="registration-mode-toggle"
                  role="group"
                  aria-label="Sponsor consent"
                >
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
                    id="dataPrivacyConsent-special"
                    name="dataPrivacyConsent"
                    type="checkbox"
                    checked={formData.dataPrivacyConsent}
                    onChange={(e) => updateField("dataPrivacyConsent", e.target.checked)}
                    className="registration-form-checkbox mt-1"
                  />
                  <span className="small text-muted lh-base">
                    I consent to the collection and processing of my personal data for conference
                    registration and related communications. <span className="text-accent">*</span>
                  </span>
                </label>
                {errors.dataPrivacyConsent && (
                  <p className="mt-2 mb-0 text-xs text-red-400">{errors.dataPrivacyConsent}</p>
                )}
              </div>
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
                <div
                  id="registrationMode"
                  className="registration-mode-toggle"
                  role="group"
                  aria-label="Registration type"
                >
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
                {earlyBirdAvailable ? (
                  <p className="registration-form-help mb-2">
                    Early bird is open. Senior Citizen/PWD pricing opens after early bird ends.
                  </p>
                ) : (
                  <p className="registration-form-help mb-2">
                    Early bird has ended. Senior Citizen/PWD rate is now available.
                  </p>
                )}
                <div id="registrationRate" className="registration-fee-choice-grid">
                  {rateOptions.map((rate) => {
                    const isNonMember = isNonMemberType(formData.membershipType);
                    const amount =
                      rate === "seniorPwd"
                        ? seniorPwdAmount
                        : isNonMember
                          ? nonMemberAmount
                          : earlyBirdAvailable
                            ? earlyBirdAmount
                            : regularAmount;
                    const tierLabel =
                      rate === "seniorPwd"
                        ? "Senior / PWD"
                        : isNonMember
                          ? "Non-Member"
                          : earlyBirdAvailable
                            ? "Early Bird"
                            : "Regular";
                    const meta =
                      rate === "seniorPwd"
                        ? "Valid Senior Citizen or PWD ID required"
                        : isNonMember
                          ? "Rate for participants who are not PNA members"
                          : earlyBird?.caption ||
                            (earlyBirdAvailable
                              ? "Early bird rate currently available"
                              : "Standard registration rate");
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

                <FadeReveal show={formData.registrationRate === "seniorPwd"}>
                  <div className="registration-senior-fields-row">
                    <FormField
                      label="Senior Citizen / PWD ID Number"
                      id="seniorPwdIdNumber"
                      required
                      value={formData.seniorPwdIdNumber}
                      onChange={(v) => updateField("seniorPwdIdNumber", v)}
                      onBlur={() => markFieldTouched("seniorPwdIdNumber")}
                      error={errors.seniorPwdIdNumber}
                      className="registration-senior-field"
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
                      className="registration-senior-field"
                      layout="inline"
                    />
                  </div>
                </FadeReveal>

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
                    participant; one payment and one receipt cover the whole group.
                    {earlyBirdAvailable
                      ? " During early bird, Senior Citizen/PWD is not offered yet."
                      : " Each person can choose Regular or Senior Citizen/PWD."}
                  </p>
                  {errors.members ? (
                    <p className="mb-3 text-xs text-red-500">{errors.members}</p>
                  ) : null}
                  <div id="registration-group-members" className="registration-group-members">
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
                          <SingleDatePicker
                            label="Date of Birth"
                            id={`member-${index}-dateOfBirth`}
                            required
                            value={member.dateOfBirth}
                            onChange={(v) => updateMember(index, "dateOfBirth", v)}
                            error={memberErrors[index]?.dateOfBirth}
                            max={getMaxDateOfBirthForMinAge()}
                          />
                          <div className="col-12">
                            <label className="registration-same-affiliation d-flex align-items-start gap-2 mb-0">
                              <input
                                type="checkbox"
                                className="registration-form-checkbox mt-1"
                                checked={member.sameAffiliationAsPrimary}
                                onChange={(e) =>
                                  setMemberSameAffiliation(index, e.target.checked)
                                }
                              />
                              <span className="small text-muted lh-base">
                                Same membership type, PNA zone/region, and chapter as Participant 1
                              </span>
                            </label>
                          </div>
                          <div className="col-12">
                            <div className="registration-membership-grid">
                              <div className="registration-membership-cell">
                                <SelectField
                                  label="Membership Type"
                                  id={`member-${index}-membershipType`}
                                  required
                                  value={member.membershipType}
                                  onChange={(v) => updateMember(index, "membershipType", v)}
                                  options={MEMBERSHIP_TYPE_OPTIONS}
                                  error={memberErrors[index]?.membershipType}
                                  placeholder="Select membership type"
                                  disabled={member.sameAffiliationAsPrimary}
                                  className=""
                                />
                                <FadeReveal
                                  show={member.membershipType === "renewal_member"}
                                  className="registration-fade-reveal--flush registration-fade-reveal--tight"
                                >
                                  <p className="registration-membership-notice mb-0" role="status">
                                    We encourage you to renew your PNA membership at{" "}
                                    <a
                                      href={PNA_MEMBERSHIP_RENEW_URL}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      www.philippinernurses.org
                                    </a>
                                    .
                                  </p>
                                </FadeReveal>
                              </div>
                              <FadeReveal
                                show={
                                  !isNonMemberType(member.membershipType) &&
                                  Boolean(member.membershipType)
                                }
                                className="registration-membership-cell registration-fade-reveal--flush"
                              >
                                <SelectField
                                  label="PNA Zone/Region"
                                  id={`member-${index}-pnaZone`}
                                  required
                                  value={member.pnaZone}
                                  onChange={(v) => updateMember(index, "pnaZone", v)}
                                  options={PNA_ZONE_OPTIONS}
                                  error={memberErrors[index]?.pnaZone}
                                  placeholder="Select PNA zone/region"
                                  disabled={member.sameAffiliationAsPrimary}
                                  searchable
                                  searchPlaceholder="Search zone/region..."
                                  className=""
                                />
                              </FadeReveal>
                              <FadeReveal
                                show={
                                  !isNonMemberType(member.membershipType) &&
                                  Boolean(member.membershipType)
                                }
                                className="registration-membership-cell registration-fade-reveal--flush"
                              >
                                <FormField
                                  label="PNA Chapter (For Local and Foreign based)"
                                  id={`member-${index}-pnaChapter`}
                                  required
                                  value={member.pnaChapter}
                                  onChange={(v) => updateMember(index, "pnaChapter", v)}
                                  error={memberErrors[index]?.pnaChapter}
                                  disabled={member.sameAffiliationAsPrimary}
                                  className=""
                                />
                              </FadeReveal>
                            </div>
                          </div>
                          <FormField
                            label="PRC License Number"
                            id={`member-${index}-prcLicenseNumber`}
                            required
                            value={member.prcLicenseNumber}
                            onChange={(v) => updateMember(index, "prcLicenseNumber", v)}
                            error={memberErrors[index]?.prcLicenseNumber}
                          />
                          <SingleDatePicker
                            label="PRC Initial Registration Date"
                            id={`member-${index}-prcInitialRegistrationDate`}
                            required
                            value={member.prcInitialRegistrationDate}
                            onChange={(v) =>
                              updateMember(index, "prcInitialRegistrationDate", v)
                            }
                            error={memberErrors[index]?.prcInitialRegistrationDate}
                            max={getTodayDateInput()}
                          />
                          <SingleDatePicker
                            label="PRC Expiration Date"
                            id={`member-${index}-prcExpirationDate`}
                            required
                            value={member.prcExpirationDate}
                            onChange={(v) => updateMember(index, "prcExpirationDate", v)}
                            onBlur={(value) => {
                              const error = getMemberFieldError(
                                { ...member, prcExpirationDate: value },
                                "prcExpirationDate"
                              );
                              setMemberErrors((prev) => {
                                const next = { ...prev };
                                const fieldErrors = { ...(next[index] ?? {}) };
                                if (error) fieldErrors.prcExpirationDate = error;
                                else delete fieldErrors.prcExpirationDate;
                                if (Object.keys(fieldErrors).length > 0) next[index] = fieldErrors;
                                else delete next[index];
                                return next;
                              });
                            }}
                            error={memberErrors[index]?.prcExpirationDate}
                            helpText={getPrcExpiredNote(member.prcExpirationDate)}
                            min={member.prcInitialRegistrationDate || undefined}
                            placement="top"
                          />
                          <div className="col-12">
                            <p className="form-label registration-form-label mb-2">
                              Registration rate <span className="text-accent">*</span>
                            </p>
                            <div
                              id={`member-${index}-registrationRate`}
                              className="registration-fee-choice-grid"
                            >
                              {rateOptions.map((rate) => {
                                const isNonMember = isNonMemberType(member.membershipType);
                                const amount =
                                  rate === "seniorPwd"
                                    ? seniorPwdAmount
                                    : isNonMember
                                      ? nonMemberAmount
                                      : earlyBirdAvailable
                                        ? earlyBirdAmount
                                        : regularAmount;
                                const tierLabel =
                                  rate === "seniorPwd"
                                    ? "Senior / PWD"
                                    : isNonMember
                                      ? "Non-Member"
                                      : earlyBirdAvailable
                                        ? "Early Bird"
                                        : "Regular";
                                const meta =
                                  rate === "seniorPwd"
                                    ? "Valid Senior Citizen or PWD ID required"
                                    : isNonMember
                                      ? "Rate for participants who are not PNA members"
                                      : earlyBird?.caption ||
                                        (earlyBirdAvailable
                                          ? "Early bird rate currently available"
                                          : "Standard registration rate");
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
                          <FadeReveal
                            show={member.registrationRate === "seniorPwd"}
                            className="col-12"
                          >
                            <FormField
                              label="Senior Citizen / PWD ID Number"
                              id={`member-${index}-seniorPwdIdNumber`}
                              required
                              value={member.seniorPwdIdNumber}
                              onChange={(v) => updateMember(index, "seniorPwdIdNumber", v)}
                              error={memberErrors[index]?.seniorPwdIdNumber}
                              className="registration-senior-field"
                            />
                          </FadeReveal>
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
                    : ""}
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

                <div className="col-12 mt-4 registration-sales-invoice-block">
                  <p className="form-label registration-form-label mb-2">
                    Do you want to secure a sales invoice? <span className="text-accent">*</span>
                  </p>
                  <p className="registration-form-help mb-2">
                    Choose yes only if you need an official sales invoice. BIR Form 2303 and 2307
                    will be required.
                  </p>
                  <div
                    id="wantsSalesInvoice"
                    className="registration-mode-toggle"
                    role="group"
                    aria-label="Sales invoice preference"
                  >
                    <button
                      type="button"
                      className={`registration-mode-option${
                        formData.wantsSalesInvoice === "yes" ? " is-selected" : ""
                      }`}
                      onClick={() => updateField("wantsSalesInvoice", "yes")}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`registration-mode-option${
                        formData.wantsSalesInvoice === "no" ? " is-selected" : ""
                      }`}
                      onClick={() => updateField("wantsSalesInvoice", "no")}
                    >
                      No
                    </button>
                  </div>
                  {errors.wantsSalesInvoice ? (
                    <p className="mt-1 text-xs text-red-400">{errors.wantsSalesInvoice}</p>
                  ) : null}

                  <FadeReveal
                    show={
                      formData.wantsSalesInvoice === "no" &&
                      formData.registrationMode === "single"
                    }
                    className="registration-fade-reveal--flush registration-sales-invoice-followup"
                  >
                    <div className="registration-sales-invoice-followup-inner">
                      <p className="form-label registration-form-label mb-1">
                        Name under the receipt
                      </p>
                      <p className="registration-form-help mb-0">
                        <strong>
                          {formatReceiptPersonName(
                            formData.firstName,
                            formData.middleName,
                            formData.lastName
                          ) || "—"}
                        </strong>
                      </p>
                    </div>
                  </FadeReveal>

                  <FadeReveal
                    show={
                      formData.wantsSalesInvoice === "no" &&
                      formData.registrationMode === "group"
                    }
                    className="registration-fade-reveal--flush registration-sales-invoice-followup"
                  >
                    <div className="registration-sales-invoice-followup-inner">
                      <SelectField
                        label="Whose name should appear on the receipt?"
                        id="receiptNamedParticipantKey"
                        required
                        value={formData.receiptNamedParticipantKey}
                        onChange={(v) => updateField("receiptNamedParticipantKey", v)}
                        options={[
                          { value: "", label: "Select a participant" },
                          {
                            value: "primary",
                            label:
                              formatReceiptPersonName(
                                formData.firstName,
                                formData.middleName,
                                formData.lastName
                              ) || "Participant 1",
                          },
                          ...members.map((member, index) => ({
                            value: `member-${index}`,
                            label:
                              formatReceiptPersonName(
                                member.firstName,
                                member.middleName,
                                member.lastName
                              ) || `Participant ${index + 2}`,
                          })),
                        ]}
                        error={errors.receiptNamedParticipantKey || errors.receiptNamedUnder}
                        placeholder="Select a participant"
                      />
                    </div>
                  </FadeReveal>

                  <FadeReveal
                    show={formData.wantsSalesInvoice === "yes"}
                    className="registration-fade-reveal--flush registration-sales-invoice-followup"
                  >
                    <div className="registration-sales-invoice-followup-inner registration-sales-invoice-tax-docs">
                      <div className="registration-bir-upload-row">
                        <div className="registration-bir-upload-col">
                          <FileField
                            label="Upload BIR Form 2303"
                            id="bir2303File"
                            required
                            accept="image/*,application/pdf"
                            hint="(Certificate of Registration, max 10 MB)"
                            file={bir2303File}
                            onChange={(file) => {
                              void handleBir2303Selected(file);
                            }}
                            error={errors.bir2303File}
                            className=""
                          />
                          {bir2303OcrStatus === "scanning" ? (
                            <p className="mb-0 text-xs text-muted" role="status">
                              Scanning BIR Form 2303 for institution / company name…
                            </p>
                          ) : null}
                          {bir2303OcrMessage ? (
                            <p className="mb-0 text-xs text-muted" role="status">
                              {bir2303OcrMessage}
                            </p>
                          ) : null}
                          <FormField
                            label="Institution / company name on BIR Form 2303"
                            id="bir2303InstitutionName"
                            required
                            value={formData.bir2303InstitutionName}
                            onChange={(v) => updateField("bir2303InstitutionName", v)}
                            onBlur={() => markFieldTouched("bir2303InstitutionName")}
                            error={errors.bir2303InstitutionName}
                            className=""
                            disabled={bir2303OcrStatus === "scanning"}
                          />
                          <p className="registration-form-help mb-0">
                            We try to read this from your uploaded BIR Form 2303. Please confirm it
                            is correct — this name will appear on the sales invoice / receipt.
                          </p>
                        </div>
                        <div className="registration-bir-upload-col">
                          <FileField
                            label="Upload BIR Form 2307"
                            id="bir2307File"
                            required
                            accept="image/*,application/pdf"
                            hint="(Certificate of Creditable Tax Withheld, max 10 MB)"
                            file={bir2307File}
                            onChange={(file) =>
                              handleGenericFileSelected(file, "bir2307File", setBir2307File)
                            }
                            error={errors.bir2307File}
                            className=""
                          />
                        </div>
                      </div>
                      <div>
                        <p className="form-label registration-form-label mb-1">
                          Name under the receipt
                        </p>
                        <p className="registration-form-help mb-0">
                          <strong>
                            {formData.bir2303InstitutionName.trim() || "—"}
                          </strong>
                          <span className="text-muted">
                            {" "}
                            (from your BIR Form 2303 institution name)
                          </span>
                        </p>
                      </div>
                    </div>
                  </FadeReveal>
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
                <div
                  id="sponsorConsent"
                  className="registration-mode-toggle"
                  role="group"
                  aria-label="Sponsor consent"
                >
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
                    prior to the event
                    {formData.wantsSalesInvoice === "yes"
                      ? ", and submission of BIR Form 2303 and BIR Form 2307 for the requested sales invoice"
                      : ""}
                    . I consent to the collection and processing of my personal data in accordance
                    with the Data Privacy Act of 2012 (Republic Act No. 10173).
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
                  wantsSalesInvoice: formData.wantsSalesInvoice,
                  bir2303InstitutionName: formData.bir2303InstitutionName,
                  receiptNamedUnder: formData.receiptNamedUnder,
                  receiptNamedParticipantKey: formData.receiptNamedParticipantKey,
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
                disabled={loading || ocrStatus === "scanning" || bir2303OcrStatus === "scanning"}
                className="registration-form-footer-btn registration-form-footer-btn--primary"
              >
                {loading
                  ? "Processing..."
                  : ocrStatus === "scanning" || bir2303OcrStatus === "scanning"
                    ? "Scanning document..."
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
  disabled = false,
  className = "col-12 col-md-6",
}: {
  label: string;
  id: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  error?: string;
  placeholder?: string;
  maxLength?: number;
  min?: string;
  max?: string;
  disabled?: boolean;
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
        onBlur={(e) => onBlur?.(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        disabled={disabled}
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
  disabled = false,
  searchable = false,
  searchPlaceholder,
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
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
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
        disabled={disabled}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
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
  layout = "stacked",
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
  layout?: "stacked" | "inline";
}) {
  if (layout === "inline") {
    return (
      <div className={`${className} registration-file-field-inline`.trim()}>
        <div className="registration-file-field-inline-row">
          <label htmlFor={id} className="form-label registration-form-label mb-0">
            {label} {required && <span className="text-accent">*</span>}
            {hint ? <span className="registration-form-optional"> {hint}</span> : null}
          </label>
          <input
            id={id}
            type="file"
            accept={accept}
            className={`input-dark registration-file-input registration-file-field-inline-input ${
              error ? "input-dark-error" : ""
            }`}
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </div>
        {file ? <p className="mt-2 mb-0 text-xs text-muted">Selected: {file.name}</p> : null}
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

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
        className={`input-dark registration-file-input ${error ? "input-dark-error" : ""}`}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? <p className="mt-2 mb-0 text-xs text-muted">Selected: {file.name}</p> : null}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
