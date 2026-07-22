import { conference, type RegistrationCategory } from "@/lib/conference";
import type { ConferenceEvent, EventFee, FeeTier } from "@/lib/types/admin";

export type { FeeTier };

function parseDeadline(value: string | undefined | null): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveFeeTier(
  event: Pick<ConferenceEvent, "earlyBirdDeadline"> | null | undefined,
  at: Date = new Date()
): FeeTier {
  const earlyDeadline = parseDeadline(event?.earlyBirdDeadline);
  if (!earlyDeadline) return "early";

  // Early bird ends at end of deadline day.
  const endOfDay = new Date(earlyDeadline);
  endOfDay.setHours(23, 59, 59, 999);
  return at.getTime() <= endOfDay.getTime() ? "early" : "regular";
}

export function getFeesForEvent(
  event: Pick<ConferenceEvent, "fees"> | null | undefined
): Record<RegistrationCategory, EventFee> {
  return (event?.fees ?? conference.registration.fees) as Record<
    RegistrationCategory,
    EventFee
  >;
}

export function resolvePaymentAmount(
  category: RegistrationCategory,
  feeTier: FeeTier,
  event?: Pick<ConferenceEvent, "fees"> | null
): number {
  const fees = getFeesForEvent(event);
  const fee = fees[category] ?? conference.registration.fees[category];
  return feeTier === "regular" ? fee.regular : fee.early;
}

export function formatPeso(amount: number): string {
  return `₱${Math.round(amount).toLocaleString("en-PH")}`;
}
