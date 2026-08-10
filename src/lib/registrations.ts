import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import type { RegistrationCategory } from "@/lib/conference";
import { getEventById } from "@/lib/events";
import {
  resolveAppliedFee,
  type FeeTier,
} from "@/lib/registration-fees";
import { MAX_GROUP_SIZE } from "@/lib/registrations-constants";
import type {
  AdminStats,
  AppliedFeeKey,
  CheckInStatus,
  FoodPreference,
  GroupRegistrationInput,
  MembershipType,
  PaymentStatus,
  RegistrationGroupMemberNote,
  RegistrationGroupRole,
  RegistrationInput,
  RegistrationModeChoice,
  RegistrationRateChoice,
  RegistrationRecord,
  SponsorConsent,
} from "@/lib/types/admin";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "registrations.json");

export { MAX_GROUP_SIZE };

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

function createCheckInToken(): string {
  return randomBytes(24).toString("base64url");
}

function deriveLegacyPayment(raw: RegistrationRecord): {
  feeTier: FeeTier;
  paymentAmount: number;
  appliedFeeKey: AppliedFeeKey | "";
  feeLabel: string;
  registrationRate: RegistrationRateChoice | "";
} {
  const paymentAmount =
    typeof raw.paymentAmount === "number" && Number.isFinite(raw.paymentAmount)
      ? raw.paymentAmount
      : 0;

  if (raw.appliedFeeKey === "earlyBird" || raw.appliedFeeKey === "regular" || raw.appliedFeeKey === "seniorPwd") {
    return {
      feeTier: raw.appliedFeeKey === "earlyBird" ? "early" : "regular",
      paymentAmount,
      appliedFeeKey: raw.appliedFeeKey,
      feeLabel: raw.feeLabel || raw.appliedFeeKey,
      registrationRate:
        raw.registrationRate === "seniorPwd" || raw.registrationRate === "regular"
          ? raw.registrationRate
          : raw.appliedFeeKey === "seniorPwd"
            ? "seniorPwd"
            : "regular",
    };
  }

  const feeTier: FeeTier = raw.feeTier === "regular" ? "regular" : "early";
  return {
    feeTier,
    paymentAmount,
    appliedFeeKey: "",
    feeLabel: raw.feeLabel || String(raw.category || ""),
    registrationRate:
      raw.registrationRate === "seniorPwd" || raw.registrationRate === "regular"
        ? raw.registrationRate
        : "",
  };
}

function normalizeGroupMembersNote(raw: unknown): RegistrationGroupMemberNote[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = (item ?? {}) as Partial<RegistrationGroupMemberNote>;
    return {
      lastName: row.lastName?.trim() ?? "",
      firstName: row.firstName?.trim() ?? "",
      middleName: row.middleName?.trim() ?? "",
      email: row.email?.trim() ?? "",
      phone: row.phone?.trim() ?? "",
      dateOfBirth: row.dateOfBirth?.trim() ?? "",
      prcLicenseNumber: row.prcLicenseNumber?.trim() ?? "",
      prcInitialRegistrationDate: row.prcInitialRegistrationDate?.trim() ?? "",
      prcExpirationDate: row.prcExpirationDate?.trim() ?? "",
      foodPreference: (row.foodPreference as FoodPreference) || "regular",
      foodAllergyNote: row.foodAllergyNote?.trim() ?? "",
      registrationRate:
        row.registrationRate === "seniorPwd" || row.registrationRate === "regular"
          ? row.registrationRate
          : "regular",
      seniorPwdIdNumber: row.seniorPwdIdNumber?.trim() ?? "",
    };
  });
}

function normalizeRegistration(raw: RegistrationRecord): RegistrationRecord {
  const now = raw.createdAt ?? new Date().toISOString();
  const derived = deriveLegacyPayment(raw);
  const middleName =
    raw.middleName?.trim() ||
    (raw.middleInitial ? `${raw.middleInitial.trim().replace(/\./g, "").toUpperCase()}.` : "");

  return {
    ...raw,
    eventId: raw.eventId ?? null,
    middleInitial: raw.middleInitial?.trim().replace(/\./g, "").slice(0, 1).toUpperCase() ?? "",
    middleName,
    dateOfBirth: raw.dateOfBirth ?? "",
    age: typeof raw.age === "number" && Number.isFinite(raw.age) ? raw.age : null,
    gender: raw.gender ?? "",
    institutionAddress: raw.institutionAddress ?? raw.address ?? "",
    membershipType: (raw.membershipType as MembershipType | "") || "",
    pnaIdNumber: raw.pnaIdNumber ?? "",
    pnaIdUrl: raw.pnaIdUrl ?? null,
    pnaZone: raw.pnaZone ?? "",
    pnaChapter: raw.pnaChapter ?? "",
    prcLicenseNumber: raw.prcLicenseNumber ?? "",
    prcInitialRegistrationDate: raw.prcInitialRegistrationDate ?? "",
    prcExpirationDate: raw.prcExpirationDate ?? "",
    prcIdUrl: raw.prcIdUrl ?? null,
    registrationMode: (raw.registrationMode as RegistrationModeChoice) || "single",
    registrationRate: derived.registrationRate,
    appliedFeeKey: derived.appliedFeeKey,
    feeLabel: derived.feeLabel,
    seniorPwdIdNumber: raw.seniorPwdIdNumber ?? "",
    seniorPwdIdUrl: raw.seniorPwdIdUrl ?? null,
    groupMembersNote: normalizeGroupMembersNote(raw.groupMembersNote),
    bir2303Url: raw.bir2303Url ?? null,
    bir2307Url: raw.bir2307Url ?? null,
    foodPreference: (raw.foodPreference as FoodPreference | "") || "",
    foodAllergyNote: raw.foodAllergyNote ?? "",
    sponsorConsent: (raw.sponsorConsent as SponsorConsent | "") || "",
    dataPrivacyConsent: Boolean(raw.dataPrivacyConsent ?? raw.agreeToTerms),
    category: (raw.category as RegistrationCategory) || "regular",
    feeTier: derived.feeTier,
    paymentAmount: derived.paymentAmount,
    address: raw.address ?? "",
    city: raw.city ?? "",
    province: raw.province ?? "",
    dietaryRequirements: raw.dietaryRequirements ?? "",
    specialNeeds: raw.specialNeeds ?? "",
    agreeToTerms: Boolean(raw.agreeToTerms ?? raw.dataPrivacyConsent),
    paymentStatus: raw.paymentStatus ?? "pending",
    receiptUrl: raw.receiptUrl ?? null,
    receiptUploadedAt: raw.receiptUploadedAt ?? null,
    paymentReference: raw.paymentReference ?? "",
    paymentNotes: raw.paymentNotes ?? "",
    adminNotes: raw.adminNotes ?? "",
    groupId: raw.groupId ?? null,
    groupRole:
      raw.groupRole === "primary" || raw.groupRole === "member" ? raw.groupRole : null,
    groupSize:
      typeof raw.groupSize === "number" && Number.isFinite(raw.groupSize) ? raw.groupSize : null,
    checkInToken: raw.checkInToken || createCheckInToken(),
    checkInStatus: raw.checkInStatus === "checked_in" ? "checked_in" : "pending",
    checkedInAt: raw.checkedInAt ?? null,
    checkedInBy: raw.checkedInBy ?? null,
    reminder3dSentAt: raw.reminder3dSentAt ?? null,
    reminder2dSentAt: raw.reminder2dSentAt ?? null,
    reminder0dSentAt: raw.reminder0dSentAt ?? null,
    evaluationInviteSentAt: raw.evaluationInviteSentAt ?? null,
    evaluationSubmittedAt: raw.evaluationSubmittedAt ?? null,
    evaluationRating:
      typeof raw.evaluationRating === "number" && Number.isFinite(raw.evaluationRating)
        ? raw.evaluationRating
        : null,
    evaluationFeedback: raw.evaluationFeedback ?? "",
    evaluationAnswers:
      raw.evaluationAnswers && typeof raw.evaluationAnswers === "object"
        ? raw.evaluationAnswers
        : {},
    certificateSentAt: raw.certificateSentAt ?? null,
    promotionSentEventIds: Array.isArray(raw.promotionSentEventIds)
      ? raw.promotionSentEventIds.filter((item): item is string => typeof item === "string")
      : [],
    updatedAt: raw.updatedAt ?? now,
  };
}

async function readRegistrations(): Promise<RegistrationRecord[]> {
  await ensureDataFile();
  const content = await fs.readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(content) as RegistrationRecord[];
  const usedTokens = new Set<string>();
  let needsPersist = false;

  const normalized = parsed.map((raw) => {
    const hadToken = Boolean(raw.checkInToken);
    const next = normalizeRegistration(raw);

    if (!hadToken || usedTokens.has(next.checkInToken)) {
      let token = next.checkInToken;
      while (!token || usedTokens.has(token)) {
        token = createCheckInToken();
      }
      next.checkInToken = token;
      needsPersist = true;
    }

    usedTokens.add(next.checkInToken);
    return next;
  });

  if (needsPersist) {
    await writeRegistrations(normalized);
  }

  return normalized;
}

async function writeRegistrations(registrations: RegistrationRecord[]): Promise<void> {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(registrations, null, 2), "utf-8");
}

function generateReferenceNumber(existing: RegistrationRecord[]): string {
  const year = new Date().getFullYear();
  let reference = "";
  do {
    // 8 hex chars → ~4.3B possibilities; not enumerable like the old 5-digit codes.
    const random = randomBytes(4).toString("hex").toUpperCase();
    reference = `PNA-${year}-${random}`;
  } while (existing.some((r) => r.referenceNumber === reference));
  return reference;
}

/** Count registrations that consumed an early-bird slot for an event. */
export async function countEarlyBirdUsed(eventId?: string | null): Promise<number> {
  const registrations = await readRegistrations();
  return registrations.filter((r) => {
    if (eventId && r.eventId !== eventId) return false;
    if (!eventId && r.eventId) return false;
    return r.appliedFeeKey === "earlyBird";
  }).length;
}

function allocateCheckInToken(existing: RegistrationRecord[]): string {
  let checkInToken = createCheckInToken();
  while (existing.some((r) => r.checkInToken === checkInToken)) {
    checkInToken = createCheckInToken();
  }
  return checkInToken;
}

function buildRegistrationRecord(
  input: RegistrationInput,
  options: {
    appliedFeeKey: AppliedFeeKey;
    feeLabel: string;
    paymentAmount: number;
    feeTier: FeeTier;
    existing: RegistrationRecord[];
    groupId?: string | null;
    groupRole?: RegistrationGroupRole | null;
    groupSize?: number | null;
  }
): RegistrationRecord {
  const now = new Date().toISOString();
  const middleName = input.middleName?.trim() || input.middleInitial?.trim() || "";
  const middleInitial =
    input.middleInitial?.trim().replace(/\./g, "").slice(0, 1).toUpperCase() ||
    middleName.slice(0, 1).toUpperCase();

  return {
    id: uuidv4(),
    referenceNumber: generateReferenceNumber(options.existing),
    eventId: input.eventId ?? null,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    middleInitial,
    middleName,
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    dateOfBirth: input.dateOfBirth.trim(),
    age: typeof input.age === "number" && Number.isFinite(input.age) ? input.age : null,
    gender: input.gender.trim(),
    organization: input.organization.trim(),
    institutionAddress: input.institutionAddress.trim(),
    position: input.position.trim(),
    membershipType: input.membershipType,
    pnaIdNumber: input.pnaIdNumber.trim(),
    pnaIdUrl: null,
    pnaZone: input.pnaZone.trim(),
    pnaChapter: input.pnaChapter.trim(),
    prcLicenseNumber: input.prcLicenseNumber.trim(),
    prcInitialRegistrationDate: input.prcInitialRegistrationDate.trim(),
    prcExpirationDate: input.prcExpirationDate.trim(),
    prcIdUrl: null,
    registrationMode: input.registrationMode,
    registrationRate: input.registrationRate,
    appliedFeeKey: options.appliedFeeKey,
    feeLabel: options.feeLabel,
    seniorPwdIdNumber: input.seniorPwdIdNumber?.trim() ?? "",
    seniorPwdIdUrl: null,
    groupMembersNote: normalizeGroupMembersNote(input.groupMembersNote),
    bir2303Url: null,
    bir2307Url: null,
    foodPreference: input.foodPreference,
    foodAllergyNote: input.foodAllergyNote?.trim() ?? "",
    sponsorConsent: input.sponsorConsent,
    dataPrivacyConsent: Boolean(input.dataPrivacyConsent),
    category: options.appliedFeeKey,
    feeTier: options.feeTier,
    paymentAmount: options.paymentAmount,
    address: input.institutionAddress.trim(),
    city: input.city?.trim() ?? "",
    province: input.province?.trim() ?? "",
    dietaryRequirements: input.foodPreference,
    specialNeeds: input.specialNeeds?.trim() ?? "",
    agreeToTerms: Boolean(input.dataPrivacyConsent ?? input.agreeToTerms),
    paymentStatus: "pending",
    receiptUrl: null,
    receiptUploadedAt: null,
    paymentReference: input.paymentReference.trim(),
    paymentNotes: "",
    adminNotes: "",
    groupId: options.groupId ?? null,
    groupRole: options.groupRole ?? null,
    groupSize: options.groupSize ?? null,
    checkInToken: allocateCheckInToken(options.existing),
    checkInStatus: "pending",
    checkedInAt: null,
    checkedInBy: null,
    reminder3dSentAt: null,
    reminder2dSentAt: null,
    reminder0dSentAt: null,
    evaluationInviteSentAt: null,
    evaluationSubmittedAt: null,
    evaluationRating: null,
    evaluationFeedback: "",
    evaluationAnswers: {},
    certificateSentAt: null,
    promotionSentEventIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

function assertEmailsAvailable(
  emails: string[],
  existing: RegistrationRecord[]
): void {
  const seen = new Set<string>();
  for (const email of emails) {
    const normalized = email.trim().toLowerCase();
    if (seen.has(normalized)) {
      throw new Error(`Duplicate email in group: ${normalized}`);
    }
    seen.add(normalized);
    if (existing.some((r) => r.email.toLowerCase() === normalized)) {
      throw new Error("A registration with this email address already exists.");
    }
  }
}

export async function createRegistration(
  input: RegistrationInput
): Promise<RegistrationRecord> {
  const registrations = await readRegistrations();
  assertEmailsAvailable([input.email], registrations);

  if (input.registrationRate === "seniorPwd" && !input.seniorPwdIdNumber?.trim()) {
    throw new Error("Senior Citizen/PWD ID number is required for this rate.");
  }
  if (!input.dataPrivacyConsent && !input.agreeToTerms) {
    throw new Error("Data privacy consent is required.");
  }
  if (!input.paymentReference?.trim()) {
    throw new Error("Payment reference number is required.");
  }

  const event = input.eventId ? await getEventById(input.eventId) : null;
  const earlyBirdUsed = await countEarlyBirdUsed(input.eventId ?? null);
  const applied = resolveAppliedFee(input.registrationRate, earlyBirdUsed, event);

  const registration = buildRegistrationRecord(input, {
    appliedFeeKey: applied.key,
    feeLabel: applied.label,
    paymentAmount: applied.amount,
    feeTier: applied.key === "earlyBird" ? "early" : "regular",
    existing: registrations,
  });

  registrations.push(registration);
  await writeRegistrations(registrations);
  return registration;
}

/**
 * Create primary + member registrations sharing one groupId and one combined payment.
 * Each person gets their own reference number and fee (Regular/Early Bird or Senior/PWD).
 * One receipt uploaded against the primary cascades to the whole group.
 */
export async function createGroupRegistrations(
  input: GroupRegistrationInput
): Promise<RegistrationRecord[]> {
  const members = input.members ?? [];
  if (members.length < 1) {
    throw new Error("Group registration requires at least one additional participant.");
  }
  const groupSize = 1 + members.length;
  if (groupSize > MAX_GROUP_SIZE) {
    throw new Error(`Group registration allows up to ${MAX_GROUP_SIZE} participants.`);
  }

  for (const member of members) {
    if (member.registrationRate !== "regular" && member.registrationRate !== "seniorPwd") {
      throw new Error("Each group member must choose Regular or Senior Citizen/PWD rate.");
    }
    if (member.registrationRate === "seniorPwd" && !member.seniorPwdIdNumber?.trim()) {
      throw new Error(
        `Senior Citizen/PWD ID number is required for ${member.firstName} ${member.lastName}.`
      );
    }
  }
  if (input.primary.registrationRate === "seniorPwd" && !input.primary.seniorPwdIdNumber?.trim()) {
    throw new Error("Senior Citizen/PWD ID number is required for the primary registrant.");
  }

  const registrations = await readRegistrations();
  const allEmails = [input.primary.email, ...members.map((m) => m.email)];
  assertEmailsAvailable(allEmails, registrations);

  const event = input.primary.eventId ? await getEventById(input.primary.eventId) : null;
  let earlyBirdUsed = await countEarlyBirdUsed(input.primary.eventId ?? null);
  const groupId = uuidv4();
  const created: RegistrationRecord[] = [];
  const working = [...registrations];

  const primaryApplied = resolveAppliedFee(
    input.primary.registrationRate,
    earlyBirdUsed,
    event
  );
  if (primaryApplied.key === "earlyBird") earlyBirdUsed += 1;

  const primary = buildRegistrationRecord(
    { ...input.primary, registrationMode: "group", groupMembersNote: [] },
    {
      appliedFeeKey: primaryApplied.key,
      feeLabel: primaryApplied.label,
      paymentAmount: primaryApplied.amount,
      feeTier: primaryApplied.key === "earlyBird" ? "early" : "regular",
      existing: working,
      groupId,
      groupRole: "primary",
      groupSize,
    }
  );
  working.push(primary);
  created.push(primary);

  for (const member of members) {
    const memberApplied = resolveAppliedFee(member.registrationRate, earlyBirdUsed, event);
    if (memberApplied.key === "earlyBird") earlyBirdUsed += 1;

    const memberInput: RegistrationInput = {
      firstName: member.firstName,
      lastName: member.lastName,
      middleName: member.middleName ?? member.middleInitial ?? "",
      email: member.email,
      phone: member.phone,
      dateOfBirth: member.dateOfBirth ?? "",
      age: null,
      gender: input.primary.gender,
      organization: input.primary.organization,
      institutionAddress: input.primary.institutionAddress,
      position: input.primary.position,
      membershipType: input.primary.membershipType,
      pnaIdNumber: input.primary.pnaIdNumber,
      pnaZone: input.primary.pnaZone,
      pnaChapter: input.primary.pnaChapter,
      prcLicenseNumber: member.prcLicenseNumber ?? "",
      prcInitialRegistrationDate: member.prcInitialRegistrationDate ?? "",
      prcExpirationDate: member.prcExpirationDate ?? "",
      registrationMode: "group",
      registrationRate: member.registrationRate,
      seniorPwdIdNumber: member.seniorPwdIdNumber,
      foodPreference: member.foodPreference ?? "regular",
      foodAllergyNote: member.foodAllergyNote,
      sponsorConsent: input.primary.sponsorConsent,
      dataPrivacyConsent: input.primary.dataPrivacyConsent,
      paymentReference: input.primary.paymentReference,
      eventId: input.primary.eventId,
    };

    const record = buildRegistrationRecord(memberInput, {
      appliedFeeKey: memberApplied.key,
      feeLabel: memberApplied.label,
      paymentAmount: memberApplied.amount,
      feeTier: memberApplied.key === "earlyBird" ? "early" : "regular",
      existing: working,
      groupId,
      groupRole: "member",
      groupSize,
    });
    working.push(record);
    created.push(record);
  }

  await writeRegistrations(working);
  return created;
}

export async function getRegistrationsByGroupId(
  groupId: string
): Promise<RegistrationRecord[]> {
  if (!groupId.trim()) return [];
  const registrations = await readRegistrations();
  return registrations.filter((r) => r.groupId === groupId);
}

export async function getRegistrationByReference(
  referenceNumber: string
): Promise<RegistrationRecord | null> {
  const registrations = await readRegistrations();
  return (
    registrations.find(
      (r) => r.referenceNumber.toUpperCase() === referenceNumber.toUpperCase()
    ) ?? null
  );
}

export async function getRegistrationById(
  id: string
): Promise<RegistrationRecord | null> {
  const registrations = await readRegistrations();
  return registrations.find((r) => r.id === id) ?? null;
}

export async function getRegistrationByCheckInToken(
  token: string
): Promise<RegistrationRecord | null> {
  if (!token.trim()) return null;
  const registrations = await readRegistrations();
  return registrations.find((r) => r.checkInToken === token.trim()) ?? null;
}

export async function getAllRegistrations(): Promise<RegistrationRecord[]> {
  const registrations = await readRegistrations();
  return registrations.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function updateRegistrationPayment(
  id: string,
  updates: {
    paymentStatus?: PaymentStatus;
    adminNotes?: string;
    paymentNotes?: string;
    paymentReference?: string;
    receiptUrl?: string | null;
    receiptUploadedAt?: string | null;
    pnaIdUrl?: string | null;
    prcIdUrl?: string | null;
    bir2303Url?: string | null;
    bir2307Url?: string | null;
    seniorPwdIdUrl?: string | null;
  }
): Promise<RegistrationRecord | null> {
  const registrations = await readRegistrations();
  const index = registrations.findIndex((r) => r.id === id);
  if (index === -1) return null;

  registrations[index] = {
    ...registrations[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeRegistrations(registrations);
  return registrations[index];
}

/**
 * Apply payment/receipt updates to a registration and, when grouped,
 * to every other member sharing the same groupId.
 * Returns all updated records (primary target first).
 */
export async function updateRegistrationPaymentCascading(
  id: string,
  updates: {
    paymentStatus?: PaymentStatus;
    adminNotes?: string;
    paymentNotes?: string;
    paymentReference?: string;
    receiptUrl?: string | null;
    receiptUploadedAt?: string | null;
    pnaIdUrl?: string | null;
    prcIdUrl?: string | null;
    bir2303Url?: string | null;
    bir2307Url?: string | null;
    seniorPwdIdUrl?: string | null;
  }
): Promise<RegistrationRecord[]> {
  const registrations = await readRegistrations();
  const index = registrations.findIndex((r) => r.id === id);
  if (index === -1) return [];

  const target = registrations[index];
  const now = new Date().toISOString();
  const groupId = target.groupId;
  const idsToUpdate = new Set<string>([id]);

  if (groupId) {
    for (const row of registrations) {
      if (row.groupId === groupId) idsToUpdate.add(row.id);
    }
  }

  const updated: RegistrationRecord[] = [];
  for (let i = 0; i < registrations.length; i++) {
    if (!idsToUpdate.has(registrations[i].id)) continue;
    registrations[i] = {
      ...registrations[i],
      ...updates,
      updatedAt: now,
    };
    updated.push(registrations[i]);
  }

  await writeRegistrations(registrations);
  // Keep the originally requested record first for callers.
  updated.sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : 0));
  return updated;
}

export async function markRegistrationCheckedIn(
  id: string,
  checkedInBy: string | null
): Promise<RegistrationRecord | null> {
  const registrations = await readRegistrations();
  const index = registrations.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const current = registrations[index];
  if (current.checkInStatus === "checked_in") {
    return current;
  }

  registrations[index] = {
    ...current,
    checkInStatus: "checked_in",
    checkedInAt: new Date().toISOString(),
    checkedInBy,
    updatedAt: new Date().toISOString(),
  };

  await writeRegistrations(registrations);
  return registrations[index];
}

export async function markReminderSent(
  id: string,
  window: "3d" | "2d" | "0d"
): Promise<RegistrationRecord | null> {
  const registrations = await readRegistrations();
  const index = registrations.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const field =
    window === "3d"
      ? "reminder3dSentAt"
      : window === "2d"
        ? "reminder2dSentAt"
        : "reminder0dSentAt";

  registrations[index] = {
    ...registrations[index],
    [field]: now,
    updatedAt: now,
  };

  await writeRegistrations(registrations);
  return registrations[index];
}

export async function markEvaluationInviteSent(id: string): Promise<RegistrationRecord | null> {
  const registrations = await readRegistrations();
  const index = registrations.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  registrations[index] = {
    ...registrations[index],
    evaluationInviteSentAt: registrations[index].evaluationInviteSentAt ?? now,
    updatedAt: now,
  };

  await writeRegistrations(registrations);
  return registrations[index];
}

export async function submitRegistrationEvaluation(
  id: string,
  answers: Record<string, string | number>
): Promise<RegistrationRecord | null> {
  const registrations = await readRegistrations();
  const index = registrations.findIndex((r) => r.id === id);
  if (index === -1) return null;

  let rating: number | null = null;
  for (const value of Object.values(answers)) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5) {
      rating = parsed;
      break;
    }
  }

  const feedback =
    typeof answers.feedback === "string"
      ? answers.feedback
      : Object.entries(answers).find(([key, value]) => key.includes("feedback") && typeof value === "string")?.[1]?.toString() ?? "";

  const now = new Date().toISOString();
  registrations[index] = {
    ...registrations[index],
    evaluationSubmittedAt: now,
    evaluationRating: Number.isFinite(rating) ? (rating as number) : null,
    evaluationFeedback: feedback,
    evaluationAnswers: answers,
    updatedAt: now,
  };

  await writeRegistrations(registrations);
  return registrations[index];
}

export async function markCertificateSent(id: string): Promise<RegistrationRecord | null> {
  const registrations = await readRegistrations();
  const index = registrations.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  registrations[index] = {
    ...registrations[index],
    certificateSentAt: now,
    updatedAt: now,
  };

  await writeRegistrations(registrations);
  return registrations[index];
}

export async function markPromotionSent(
  id: string,
  promotedEventId: string
): Promise<RegistrationRecord | null> {
  const registrations = await readRegistrations();
  const index = registrations.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const current = registrations[index];
  if (current.promotionSentEventIds.includes(promotedEventId)) {
    return current;
  }

  const now = new Date().toISOString();
  registrations[index] = {
    ...current,
    promotionSentEventIds: [...current.promotionSentEventIds, promotedEventId],
    updatedAt: now,
  };

  await writeRegistrations(registrations);
  return registrations[index];
}

/** Persist any lazily backfilled check-in tokens (for legacy records). */
export async function persistNormalizedRegistrations(): Promise<number> {
  const before = await fs.readFile(DATA_FILE, "utf-8").catch(() => "[]");
  const registrations = await readRegistrations();
  await writeRegistrations(registrations);
  const after = JSON.stringify(registrations, null, 2);
  return before === after ? 0 : registrations.length;
}

export async function deleteRegistration(id: string): Promise<boolean> {
  const registrations = await readRegistrations();
  const index = registrations.findIndex((r) => r.id === id);
  if (index === -1) return false;

  registrations.splice(index, 1);
  await writeRegistrations(registrations);
  return true;
}

export async function submitReceipt(
  referenceNumber: string,
  receiptUrl: string,
  options?: { paymentReference?: string }
): Promise<RegistrationRecord | null> {
  const registration = await getRegistrationByReference(referenceNumber);
  if (!registration) return null;

  // pending, receipt_issue, rejected, and receipt_submitted can re-upload.
  if (registration.paymentStatus === "paid") {
    throw new Error("This registration is already marked as paid.");
  }

  if (registration.groupId) {
    const group = await getRegistrationsByGroupId(registration.groupId);
    if (group.some((r) => r.paymentStatus === "paid")) {
      throw new Error("This group registration is already marked as paid.");
    }
  }

  const paymentReference = options?.paymentReference?.trim() ?? "";

  const updated = await updateRegistrationPaymentCascading(registration.id, {
    receiptUrl,
    receiptUploadedAt: new Date().toISOString(),
    paymentStatus: "receipt_submitted",
    paymentNotes: "",
    ...(paymentReference ? { paymentReference } : {}),
  });

  return updated[0] ?? null;
}

export async function getAdminStats(): Promise<AdminStats> {
  const registrations = await readRegistrations();
  const { getAllEvents } = await import("@/lib/events");
  const events = await getAllEvents();

  return {
    totalParticipants: registrations.length,
    paid: registrations.filter((r) => r.paymentStatus === "paid").length,
    pending: registrations.filter((r) => r.paymentStatus === "pending").length,
    receiptSubmitted: registrations.filter((r) => r.paymentStatus === "receipt_submitted")
      .length,
    receiptIssue: registrations.filter((r) => r.paymentStatus === "receipt_issue").length,
    rejected: registrations.filter((r) => r.paymentStatus === "rejected").length,
    activeEvents: events.filter((e) => e.status === "open").length,
    upcomingEvents: events.filter((e) => e.status === "upcoming").length,
  };
}

export async function countParticipantsUnderReview(): Promise<number> {
  const registrations = await readRegistrations();
  return registrations.filter((registration) => registration.paymentStatus === "receipt_submitted")
    .length;
}

export type {
  RegistrationInput,
  RegistrationRecord,
  PaymentStatus,
  CheckInStatus,
  GroupRegistrationInput,
};
