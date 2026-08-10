import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { conference, type RegistrationCategory } from "@/lib/conference";
import { getEventById } from "@/lib/events";
import {
  resolveFeeTier,
  resolvePaymentAmount,
  type FeeTier,
} from "@/lib/registration-fees";
import { MAX_GROUP_SIZE } from "@/lib/registrations-constants";
import type {
  AdminStats,
  CheckInStatus,
  GroupRegistrationInput,
  PaymentStatus,
  RegistrationGroupRole,
  RegistrationInput,
  RegistrationRecord,
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

function deriveLegacyPayment(
  raw: RegistrationRecord
): { feeTier: FeeTier; paymentAmount: number } {
  const category = (raw.category in conference.registration.fees
    ? raw.category
    : "member") as RegistrationCategory;
  const feeTier: FeeTier = raw.feeTier === "regular" ? "regular" : "early";
  const paymentAmount =
    typeof raw.paymentAmount === "number" && Number.isFinite(raw.paymentAmount)
      ? raw.paymentAmount
      : resolvePaymentAmount(category, feeTier, null);
  return { feeTier, paymentAmount };
}

function normalizeRegistration(raw: RegistrationRecord): RegistrationRecord {
  const now = raw.createdAt ?? new Date().toISOString();
  const { feeTier, paymentAmount } = deriveLegacyPayment(raw);
  return {
    ...raw,
    eventId: raw.eventId ?? null,
    middleInitial: raw.middleInitial?.trim().replace(/\./g, "").slice(0, 1).toUpperCase() ?? "",
    feeTier,
    paymentAmount,
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

/** Server-authoritative fee tier: clients may choose regular during early bird, never early after deadline. */
function resolveTrustedFeeTier(
  requested: FeeTier | "" | undefined,
  event: Awaited<ReturnType<typeof getEventById>>
): FeeTier {
  const serverTier = resolveFeeTier(event);
  if (requested === "regular") return "regular";
  if (requested === "early" && serverTier === "early") return "early";
  return serverTier;
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
    feeTier: FeeTier;
    paymentAmount: number;
    groupId: string | null;
    groupRole: RegistrationGroupRole | null;
    groupSize: number | null;
    existing: RegistrationRecord[];
  }
): RegistrationRecord {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    referenceNumber: generateReferenceNumber(options.existing),
    eventId: input.eventId ?? null,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    middleInitial: input.middleInitial?.trim().replace(/\./g, "").slice(0, 1).toUpperCase() ?? "",
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    organization: input.organization.trim(),
    position: input.position.trim(),
    category: input.category,
    feeTier: options.feeTier,
    paymentAmount: options.paymentAmount,
    address: input.address.trim(),
    city: input.city.trim(),
    province: input.province.trim(),
    dietaryRequirements: input.dietaryRequirements?.trim() ?? "",
    specialNeeds: input.specialNeeds?.trim() ?? "",
    agreeToTerms: input.agreeToTerms,
    paymentStatus: "pending",
    receiptUrl: null,
    receiptUploadedAt: null,
    paymentReference: "",
    paymentNotes: "",
    adminNotes: "",
    groupId: options.groupId,
    groupRole: options.groupRole,
    groupSize: options.groupSize,
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

  const event = input.eventId ? await getEventById(input.eventId) : null;
  const feeTier = resolveTrustedFeeTier(input.feeTier, event);
  const paymentAmount = resolvePaymentAmount(input.category, feeTier, event);

  const registration = buildRegistrationRecord(input, {
    feeTier,
    paymentAmount,
    groupId: null,
    groupRole: null,
    groupSize: null,
    existing: registrations,
  });

  registrations.push(registration);
  await writeRegistrations(registrations);
  return registration;
}

export async function createGroupRegistrations(
  input: GroupRegistrationInput
): Promise<RegistrationRecord[]> {
  const members = input.members ?? [];
  const groupSize = 1 + members.length;

  if (members.length < 1) {
    throw new Error("Group registration requires at least one additional participant.");
  }
  if (groupSize > MAX_GROUP_SIZE) {
    throw new Error(`Group registration allows up to ${MAX_GROUP_SIZE} participants.`);
  }

  const registrations = await readRegistrations();
  const allEmails = [input.primary.email, ...members.map((m) => m.email)];
  assertEmailsAvailable(allEmails, registrations);

  const event = input.primary.eventId ? await getEventById(input.primary.eventId) : null;
  const feeTier = resolveTrustedFeeTier(input.primary.feeTier, event);
  const paymentAmount = resolvePaymentAmount(input.primary.category, feeTier, event);

  const groupId = uuidv4();
  const created: RegistrationRecord[] = [];
  const working = [...registrations];

  const primary = buildRegistrationRecord(input.primary, {
    feeTier,
    paymentAmount,
    groupId,
    groupRole: "primary",
    groupSize,
    existing: working,
  });
  working.push(primary);
  created.push(primary);

  for (const member of members) {
    const memberInput: RegistrationInput = {
      firstName: member.firstName,
      lastName: member.lastName,
      middleInitial: member.middleInitial,
      email: member.email,
      phone: member.phone,
      organization: input.primary.organization,
      position: input.primary.position,
      category: input.primary.category,
      feeTier,
      paymentAmount,
      address: input.primary.address,
      city: input.primary.city,
      province: input.primary.province,
      dietaryRequirements: "",
      specialNeeds: "",
      agreeToTerms: input.primary.agreeToTerms,
      eventId: input.primary.eventId,
    };
    const record = buildRegistrationRecord(memberInput, {
      feeTier,
      paymentAmount,
      groupId,
      groupRole: "member",
      groupSize,
      existing: working,
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
