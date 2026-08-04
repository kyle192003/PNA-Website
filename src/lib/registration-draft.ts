import { conference, type RegistrationCategory } from "@/lib/conference";
import type { FeeTier } from "@/lib/types/admin";
import { MAX_GROUP_SIZE } from "@/lib/registrations-constants";

const STORAGE_PREFIX = "pna-registration-draft";
const validCategories = new Set(
  Object.keys(conference.registration.fees) as RegistrationCategory[]
);
const validFeeTiers = new Set<FeeTier>(["early", "regular"]);

export type RegistrationMode = "individual" | "group";

export interface GroupMemberDraft {
  firstName: string;
  lastName: string;
  middleInitial: string;
  email: string;
  phone: string;
}

export interface RegistrationDraft {
  mode: RegistrationMode;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  email: string;
  phone: string;
  organization: string;
  position: string;
  category: RegistrationCategory | "";
  feeTier: FeeTier | "";
  address: string;
  city: string;
  province: string;
  dietaryRequirements: string;
  specialNeeds: string;
  agreeToTerms: boolean;
  members: GroupMemberDraft[];
  savedAt: string;
}

export type RegistrationDraftInput = Omit<RegistrationDraft, "savedAt">;

export function createEmptyGroupMember(): GroupMemberDraft {
  return {
    firstName: "",
    lastName: "",
    middleInitial: "",
    email: "",
    phone: "",
  };
}

function getStorageKey(eventId: string | null | undefined): string {
  return `${STORAGE_PREFIX}:${eventId ?? "general"}`;
}

function normalizeMember(raw: Partial<GroupMemberDraft> | undefined): GroupMemberDraft {
  return {
    firstName: raw?.firstName?.trim() ?? "",
    lastName: raw?.lastName?.trim() ?? "",
    middleInitial: raw?.middleInitial?.trim().replace(/\./g, "").slice(0, 1).toUpperCase() ?? "",
    email: raw?.email?.trim() ?? "",
    phone: raw?.phone?.trim() ?? "",
  };
}

function normalizeDraft(raw: Partial<RegistrationDraft>): RegistrationDraft {
  const category =
    raw.category && validCategories.has(raw.category as RegistrationCategory)
      ? (raw.category as RegistrationCategory)
      : "";

  const feeTier =
    raw.feeTier && validFeeTiers.has(raw.feeTier as FeeTier)
      ? (raw.feeTier as FeeTier)
      : "";

  const mode: RegistrationMode = raw.mode === "group" ? "group" : "individual";
  const maxMembers = MAX_GROUP_SIZE - 1;
  const members = Array.isArray(raw.members)
    ? raw.members.slice(0, maxMembers).map(normalizeMember)
    : [];

  return {
    mode,
    firstName: raw.firstName?.trim() ?? "",
    lastName: raw.lastName?.trim() ?? "",
    middleInitial: raw.middleInitial?.trim().replace(/\./g, "").slice(0, 1).toUpperCase() ?? "",
    email: raw.email?.trim() ?? "",
    phone: raw.phone?.trim() ?? "",
    organization: raw.organization?.trim() ?? "",
    position: raw.position?.trim() ?? "",
    category,
    feeTier,
    address: raw.address?.trim() ?? "",
    city: raw.city?.trim() ?? "",
    province: raw.province?.trim() ?? "",
    dietaryRequirements: raw.dietaryRequirements?.trim() ?? "",
    specialNeeds: raw.specialNeeds?.trim() ?? "",
    agreeToTerms: Boolean(raw.agreeToTerms),
    members: mode === "group" ? members : [],
    savedAt: raw.savedAt ?? new Date().toISOString(),
  };
}

function memberHasContent(member: GroupMemberDraft): boolean {
  return Boolean(
    member.firstName.trim() ||
      member.lastName.trim() ||
      member.middleInitial.trim() ||
      member.email.trim() ||
      member.phone.trim()
  );
}

export function hasRegistrationDraftContent(draft: RegistrationDraftInput): boolean {
  return Boolean(
    draft.mode === "group" ||
      draft.firstName.trim() ||
      draft.lastName.trim() ||
      (draft.middleInitial?.trim() ?? "") ||
      draft.email.trim() ||
      draft.phone.trim() ||
      draft.organization.trim() ||
      draft.position.trim() ||
      draft.category ||
      draft.feeTier ||
      draft.address.trim() ||
      draft.city.trim() ||
      draft.province.trim() ||
      draft.dietaryRequirements.trim() ||
      draft.specialNeeds.trim() ||
      draft.agreeToTerms ||
      draft.members.some(memberHasContent)
  );
}

export function loadRegistrationDraft(
  eventId: string | null | undefined
): RegistrationDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(getStorageKey(eventId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<RegistrationDraft>;
    const draft = normalizeDraft(parsed);
    return hasRegistrationDraftContent(draft) ? draft : null;
  } catch {
    return null;
  }
}

export function saveRegistrationDraft(
  eventId: string | null | undefined,
  draft: RegistrationDraftInput
): void {
  if (typeof window === "undefined") return;

  try {
    if (!hasRegistrationDraftContent(draft)) {
      localStorage.removeItem(getStorageKey(eventId));
      return;
    }

    const payload: RegistrationDraft = {
      ...normalizeDraft(draft),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(getStorageKey(eventId), JSON.stringify(payload));
  } catch {
    // Ignore quota or privacy mode errors.
  }
}

export function clearRegistrationDraft(eventId: string | null | undefined): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(getStorageKey(eventId));
  } catch {
    // Ignore storage errors.
  }
}
