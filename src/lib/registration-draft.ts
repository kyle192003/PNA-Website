import type {
  FoodPreference,
  MembershipType,
  RegistrationGroupMemberNote,
  RegistrationModeChoice,
  RegistrationRateChoice,
  SponsorConsent,
} from "@/lib/types/admin";
import { parseNcrZoneFromChapter } from "@/lib/conference";
import { clearRegistrationCachedFiles } from "@/lib/registration-file-cache";

export type RegistrationMode = RegistrationModeChoice;

export type GroupMemberDraft = Omit<RegistrationGroupMemberNote, "registrationRate" | "membershipType"> & {
  registrationRate: RegistrationRateChoice | "";
  membershipType: MembershipType | "";
  /** UI-only: NCR Zone 1–6. Encoded into pnaChapter on submit. */
  pnaNcrZone: string;
  /** UI-only: copy chapter / membership / zone from Participant 1. */
  sameAffiliationAsPrimary: boolean;
};

export type RegistrationDraft = {
  mode: RegistrationMode;
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  organization: string;
  institutionAddress: string;
  position: string;
  membershipType: MembershipType | "";
  pnaIdNumber: string;
  pnaZone: string;
  pnaNcrZone: string;
  pnaChapter: string;
  prcLicenseNumber: string;
  prcInitialRegistrationDate: string;
  prcExpirationDate: string;
  registrationMode: RegistrationModeChoice;
  registrationRate: RegistrationRateChoice | "";
  seniorPwdIdNumber: string;
  members: GroupMemberDraft[];
  foodPreference: FoodPreference | "";
  foodAllergyNote: string;
  sponsorConsent: SponsorConsent | "";
  dataPrivacyConsent: boolean;
  paymentReference: string;
  wantsSalesInvoice: "" | "yes" | "no";
  bir2303InstitutionName: string;
  receiptNamedUnder: string;
  /** Group only: which participant is named on the receipt when no sales invoice. */
  receiptNamedParticipantKey: string;
  savedAt: string;
};

const DRAFT_PREFIX = "pna-registration-draft:";

/** Temporary form cache — cleared after 20 minutes of inactivity. */
const DRAFT_TTL_MS = 20 * 60 * 1000;

function draftKey(eventId?: string | null): string {
  return `${DRAFT_PREFIX}${eventId?.trim() || "general"}`;
}

function isDraftExpired(savedAt: string, now = Date.now()): boolean {
  const savedMs = Date.parse(savedAt);
  if (!Number.isFinite(savedMs)) return true;
  return now - savedMs > DRAFT_TTL_MS;
}

export function createEmptyGroupMember(): GroupMemberDraft {
  return {
    lastName: "",
    firstName: "",
    middleName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    membershipType: "",
    pnaZone: "",
    pnaNcrZone: "",
    pnaChapter: "",
    prcLicenseNumber: "",
    prcInitialRegistrationDate: "",
    prcExpirationDate: "",
    foodPreference: "regular",
    foodAllergyNote: "",
    registrationRate: "",
    seniorPwdIdNumber: "",
    sameAffiliationAsPrimary: false,
  };
}

function normalizeDraftMember(raw: Partial<GroupMemberDraft>): GroupMemberDraft {
  return {
    ...createEmptyGroupMember(),
    ...raw,
    membershipType:
      raw.membershipType === "lifetime" ||
      raw.membershipType === "regular" ||
      raw.membershipType === "renewal_member" ||
      raw.membershipType === "non_member"
        ? raw.membershipType
        : "",
    pnaZone: raw.pnaZone ?? "",
    pnaChapter: raw.pnaChapter ?? "",
    pnaNcrZone: raw.pnaNcrZone || parseNcrZoneFromChapter(raw.pnaChapter ?? ""),
    foodPreference: (raw.foodPreference as FoodPreference) || "regular",
    foodAllergyNote: raw.foodAllergyNote ?? "",
    registrationRate:
      raw.registrationRate === "seniorPwd" || raw.registrationRate === "regular"
        ? raw.registrationRate
        : "",
    seniorPwdIdNumber: raw.seniorPwdIdNumber ?? "",
    sameAffiliationAsPrimary: Boolean(raw.sameAffiliationAsPrimary),
  };
}

export function loadRegistrationDraft(eventId?: string | null): RegistrationDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RegistrationDraft>;
    const savedAt = parsed.savedAt ?? "";
    if (isDraftExpired(savedAt)) {
      clearRegistrationDraft(eventId);
      void clearRegistrationCachedFiles(eventId);
      return null;
    }
    return {
      mode: parsed.mode === "group" ? "group" : "single",
      firstName: parsed.firstName ?? "",
      lastName: parsed.lastName ?? "",
      middleName: parsed.middleName ?? "",
      email: parsed.email ?? "",
      phone: parsed.phone ?? "",
      dateOfBirth: parsed.dateOfBirth ?? "",
      age: parsed.age ?? "",
      gender: parsed.gender ?? "",
      organization: parsed.organization ?? "",
      institutionAddress: parsed.institutionAddress ?? "",
      position: parsed.position ?? "",
      membershipType:
        parsed.membershipType === "lifetime" ||
        parsed.membershipType === "regular" ||
        parsed.membershipType === "renewal_member" ||
        parsed.membershipType === "non_member"
          ? parsed.membershipType
          : "",
      pnaIdNumber: parsed.pnaIdNumber ?? "",
      pnaZone: parsed.pnaZone ?? "",
      pnaNcrZone: parsed.pnaNcrZone || parseNcrZoneFromChapter(parsed.pnaChapter ?? ""),
      pnaChapter: parsed.pnaChapter ?? "",
      prcLicenseNumber: parsed.prcLicenseNumber ?? "",
      prcInitialRegistrationDate: parsed.prcInitialRegistrationDate ?? "",
      prcExpirationDate: parsed.prcExpirationDate ?? "",
      registrationMode: parsed.registrationMode === "group" ? "group" : "single",
      registrationRate:
        parsed.registrationRate === "seniorPwd" || parsed.registrationRate === "regular"
          ? parsed.registrationRate
          : "",
      seniorPwdIdNumber: parsed.seniorPwdIdNumber ?? "",
      members: Array.isArray(parsed.members)
        ? parsed.members.map((member) => normalizeDraftMember(member))
        : [],
      foodPreference: parsed.foodPreference ?? "",
      foodAllergyNote: parsed.foodAllergyNote ?? "",
      sponsorConsent: parsed.sponsorConsent ?? "",
      dataPrivacyConsent: Boolean(parsed.dataPrivacyConsent),
      paymentReference: parsed.paymentReference ?? "",
      wantsSalesInvoice:
        parsed.wantsSalesInvoice === "yes" || parsed.wantsSalesInvoice === "no"
          ? parsed.wantsSalesInvoice
          : "",
      bir2303InstitutionName: parsed.bir2303InstitutionName ?? "",
      receiptNamedUnder: parsed.receiptNamedUnder ?? "",
      receiptNamedParticipantKey: parsed.receiptNamedParticipantKey ?? "",
      savedAt: parsed.savedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveRegistrationDraft(
  eventId: string | null | undefined,
  draft: Omit<RegistrationDraft, "savedAt">
): void {
  if (typeof window === "undefined") return;
  const payload: RegistrationDraft = {
    ...draft,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(draftKey(eventId), JSON.stringify(payload));
}

export function clearRegistrationDraft(eventId?: string | null): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(draftKey(eventId));
  clearRegistrationPrivacyAccepted(eventId);
}

const PRIVACY_PREFIX = "pna-registration-privacy:";

function privacyKey(eventId?: string | null): string {
  return `${PRIVACY_PREFIX}${eventId?.trim() || "general"}`;
}

/** True when the user already accepted the Data Privacy gate for this event. */
export function hasRegistrationPrivacyAccepted(eventId?: string | null): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(privacyKey(eventId)) === "1";
}

export function saveRegistrationPrivacyAccepted(eventId?: string | null): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(privacyKey(eventId), "1");
}

export function clearRegistrationPrivacyAccepted(eventId?: string | null): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(privacyKey(eventId));
}
