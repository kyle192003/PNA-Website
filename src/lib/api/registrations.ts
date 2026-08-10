import type {
  FoodPreference,
  MembershipType,
  RegistrationGroupMemberNote,
  RegistrationModeChoice,
  RegistrationRateChoice,
  SponsorConsent,
  PaymentStatus,
  AppliedFeeKey,
} from "@/lib/types/admin";

export interface RegistrationInput {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  age?: number | null;
  gender: string;
  organization: string;
  institutionAddress: string;
  position: string;
  membershipType: MembershipType;
  pnaIdNumber: string;
  pnaZone: string;
  pnaChapter: string;
  prcLicenseNumber: string;
  prcInitialRegistrationDate: string;
  prcExpirationDate: string;
  registrationMode: RegistrationModeChoice;
  registrationRate: RegistrationRateChoice;
  seniorPwdIdNumber?: string;
  groupMembersNote?: RegistrationGroupMemberNote[];
  foodPreference: FoodPreference;
  foodAllergyNote?: string;
  sponsorConsent: SponsorConsent;
  dataPrivacyConsent: boolean;
  paymentReference: string;
  eventId?: string | null;
}

export interface GroupMemberInput {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  prcLicenseNumber: string;
  prcInitialRegistrationDate: string;
  prcExpirationDate: string;
  foodPreference: FoodPreference;
  foodAllergyNote?: string;
  registrationRate: RegistrationRateChoice;
  seniorPwdIdNumber?: string;
}

export interface GroupRegistrationInput {
  mode: "group";
  primary: RegistrationInput;
  members: GroupMemberInput[];
  eventId?: string | null;
}

export interface RegistrationResponse {
  referenceNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  middleInitial?: string;
  email: string;
  category: string;
  feeTier?: string;
  appliedFeeKey?: AppliedFeeKey | "";
  feeLabel?: string;
  paymentAmount?: number;
  groupId?: string | null;
  groupRole?: "primary" | "member" | null;
  groupSize?: number | null;
}

export interface GroupRegistrationParticipant {
  referenceNumber: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  email: string;
  groupRole: "primary" | "member" | null;
}

export interface GroupRegistrationResult {
  registration: RegistrationResponse;
  group: {
    groupId: string | null;
    groupSize: number | null;
    totalPaymentAmount: number;
    participants: GroupRegistrationParticipant[];
  };
}

export interface RegistrationLookup {
  referenceNumber: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  emailMasked: string;
  organization: string;
  category: string;
  paymentStatus: PaymentStatus;
  paymentNotes: string;
  hasReceipt: boolean;
  canUpload: boolean;
  createdAt: string;
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? "Request failed. Please try again.";
  } catch {
    return "Request failed. Please try again.";
  }
}

export async function submitRegistration(
  input: RegistrationInput
): Promise<RegistrationResponse> {
  const response = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<RegistrationResponse>;
}

export async function submitGroupRegistration(
  input: Omit<GroupRegistrationInput, "mode">
): Promise<GroupRegistrationResult> {
  const response = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "group",
      primary: { ...input.primary, eventId: input.eventId ?? input.primary.eventId },
      members: input.members,
      eventId: input.eventId,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as GroupRegistrationResult;
  return {
    registration: data.registration,
    group: data.group,
  };
}

export async function lookupRegistration(
  reference: string,
  email: string
): Promise<RegistrationLookup> {
  const params = new URLSearchParams({
    reference,
    email,
  });
  const response = await fetch(`/api/register/lookup?${params.toString()}`);

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<RegistrationLookup>;
}

export async function submitReceipt(
  referenceNumber: string,
  file: File,
  email: string,
  paymentReference?: string
): Promise<void> {
  const formData = new FormData();
  formData.set("referenceNumber", referenceNumber);
  formData.set("email", email);
  formData.set("file", file);
  if (paymentReference?.trim()) {
    formData.set("paymentReference", paymentReference.trim());
  }

  const response = await fetch("/api/register/receipt", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function submitRegistrationDocuments(options: {
  referenceNumber: string;
  email: string;
  pnaId?: File | null;
  prcId?: File | null;
  bir2303?: File | null;
  bir2307?: File | null;
  seniorPwdId?: File | null;
}): Promise<void> {
  const formData = new FormData();
  formData.set("referenceNumber", options.referenceNumber);
  formData.set("email", options.email);
  if (options.pnaId) formData.set("pnaId", options.pnaId);
  if (options.prcId) formData.set("prcId", options.prcId);
  if (options.bir2303) formData.set("bir2303", options.bir2303);
  if (options.bir2307) formData.set("bir2307", options.bir2307);
  if (options.seniorPwdId) formData.set("seniorPwdId", options.seniorPwdId);

  const response = await fetch("/api/register/documents", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function fetchEarlyBirdStatus(eventId?: string | null): Promise<{
  used: number;
  cap: number;
  remaining: number;
  earlyBirdAmount: number;
  regularAmount: number;
  seniorPwdAmount: number;
}> {
  const params = new URLSearchParams();
  if (eventId) params.set("eventId", eventId);
  const response = await fetch(`/api/events/early-bird?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}
