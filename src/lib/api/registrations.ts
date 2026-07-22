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

export interface RegistrationResponse {
  referenceNumber: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  email: string;
  category: RegistrationCategory;
  feeTier?: FeeTier;
  paymentAmount?: number;
}

export interface RegistrationLookup {
  referenceNumber: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  email: string;
  organization: string;
  category: RegistrationCategory;
  paymentStatus: PaymentStatus;
  paymentNotes: string;
  receiptUrl: string | null;
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

export async function lookupRegistration(
  reference: string
): Promise<RegistrationLookup> {
  const response = await fetch(
    `/api/register/lookup?reference=${encodeURIComponent(reference)}`
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<RegistrationLookup>;
}

export async function submitReceipt(referenceNumber: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.set("referenceNumber", referenceNumber);
  formData.set("file", file);

  const response = await fetch("/api/register/receipt", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}
