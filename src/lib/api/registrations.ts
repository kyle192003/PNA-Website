import type { RegistrationCategory } from "@/lib/conference";
import type { FeeTier, PaymentStatus } from "@/lib/types/admin";

export interface RegistrationInput {
  firstName: string;
  lastName: string;
  middleInitial?: string;
  email: string;
  phone: string;
  organization: string;
  position: string;
  category: RegistrationCategory | "";
  feeTier?: FeeTier | "";
  address: string;
  city: string;
  province: string;
  dietaryRequirements: string;
  specialNeeds: string;
  agreeToTerms: boolean;
  eventId?: string | null;
}

export interface GroupMemberInput {
  firstName: string;
  lastName: string;
  middleInitial?: string;
  email: string;
  phone: string;
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
  middleInitial?: string;
  email: string;
  category: RegistrationCategory;
  feeTier?: FeeTier;
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
  category: RegistrationCategory;
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

  const data = (await response.json()) as {
    registration: RegistrationResponse;
  };

  return data.registration;
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

  const data = (await response.json()) as GroupRegistrationResult & {
    registration: RegistrationResponse;
  };

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
