import { conference, type EventFeeKey } from "@/lib/conference";
import type {
  ConferenceEvent,
  EventFees,
  EventRateFee,
  RegistrationRateChoice,
  AppliedFeeKey,
  FeeTier,
} from "@/lib/types/admin";
import { getDefaultEventFees } from "@/lib/types/admin";

export type { FeeTier, AppliedFeeKey, RegistrationRateChoice };

type LegacyFee = { early?: number; regular?: number; label?: string; amount?: number; cap?: number };

function asAmount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : fallback;
}

function normalizeRateFee(
  raw: LegacyFee | EventRateFee | undefined,
  fallback: EventRateFee
): EventRateFee {
  if (!raw || typeof raw !== "object") return { ...fallback };

  // New shape
  if ("amount" in raw && typeof (raw as EventRateFee).amount === "number") {
    const fee = raw as EventRateFee;
    return {
      amount: asAmount(fee.amount, fallback.amount),
      label: fee.label?.trim() || fallback.label,
      caption: fee.caption ?? fallback.caption,
      cap: typeof fee.cap === "number" ? fee.cap : fallback.cap,
    };
  }

  // Legacy nested early/regular — map early→earlyBird amount, regular→regular amount when converting categories.
  const legacy = raw as LegacyFee;
  return {
    amount: asAmount(legacy.regular ?? legacy.early, fallback.amount),
    label: legacy.label?.trim() || fallback.label,
    caption: fallback.caption,
    cap: fallback.cap,
  };
}

/** Normalize any stored/event fee object into the current EventFees shape. */
export function normalizeEventFees(raw: unknown): EventFees {
  const defaults = getDefaultEventFees();
  if (!raw || typeof raw !== "object") return defaults;

  const source = raw as Record<string, LegacyFee | EventRateFee>;

  // Already new shape
  if (source.earlyBird || source.regular || source.seniorPwd) {
    return {
      earlyBird: normalizeRateFee(source.earlyBird, defaults.earlyBird),
      regular: normalizeRateFee(source.regular, defaults.regular),
      seniorPwd: normalizeRateFee(source.seniorPwd, defaults.seniorPwd),
    };
  }

  // Legacy category fees → keep published defaults (amounts are the new schedule)
  return defaults;
}

export function getFeesForEvent(
  event: Pick<ConferenceEvent, "fees"> | null | undefined
): EventFees {
  return normalizeEventFees(event?.fees ?? conference.registration.fees);
}

export function getEarlyBirdCap(fees: EventFees): number {
  const cap = fees.earlyBird.cap;
  return typeof cap === "number" && cap > 0 ? Math.floor(cap) : 500;
}

/**
 * Resolve what the participant will be charged.
 * - seniorPwd → seniorPwd amount
 * - regular + early bird slots remaining → earlyBird
 * - regular otherwise → regular
 */
export function resolveAppliedFee(
  rateChoice: RegistrationRateChoice,
  earlyBirdUsedCount: number,
  event?: Pick<ConferenceEvent, "fees"> | null
): { key: AppliedFeeKey; amount: number; label: string } {
  const fees = getFeesForEvent(event);

  if (rateChoice === "seniorPwd") {
    return {
      key: "seniorPwd",
      amount: fees.seniorPwd.amount,
      label: fees.seniorPwd.label,
    };
  }

  const cap = getEarlyBirdCap(fees);
  if (earlyBirdUsedCount < cap) {
    return {
      key: "earlyBird",
      amount: fees.earlyBird.amount,
      label: fees.earlyBird.label,
    };
  }

  return {
    key: "regular",
    amount: fees.regular.amount,
    label: fees.regular.label,
  };
}

/** @deprecated Use resolveAppliedFee. */
export function resolveFeeTier(
  _event?: Pick<ConferenceEvent, "earlyBirdDeadline"> | null,
  _at: Date = new Date()
): FeeTier {
  return "regular";
}

/** @deprecated Use resolveAppliedFee. */
export function resolvePaymentAmount(
  categoryOrKey: string,
  feeTier: FeeTier | RegistrationRateChoice,
  event?: Pick<ConferenceEvent, "fees"> | null,
  earlyBirdUsedCount = 0
): number {
  if (categoryOrKey === "seniorPwd" || feeTier === "seniorPwd") {
    return resolveAppliedFee("seniorPwd", earlyBirdUsedCount, event).amount;
  }
  if (categoryOrKey === "earlyBird") {
    return getFeesForEvent(event).earlyBird.amount;
  }
  if (categoryOrKey === "regular" || feeTier === "regular" || feeTier === "early") {
    return resolveAppliedFee("regular", earlyBirdUsedCount, event).amount;
  }
  return resolveAppliedFee("regular", earlyBirdUsedCount, event).amount;
}

export function formatPeso(amount: number): string {
  return `₱${Math.round(amount).toLocaleString("en-PH")}`;
}

export function feeLabelForKey(
  key: EventFeeKey | string,
  event?: Pick<ConferenceEvent, "fees"> | null
): string {
  const fees = getFeesForEvent(event);
  if (key === "earlyBird") return fees.earlyBird.label;
  if (key === "seniorPwd") return fees.seniorPwd.label;
  if (key === "regular") return fees.regular.label;
  return key;
}
