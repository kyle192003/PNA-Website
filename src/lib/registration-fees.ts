import { conference, type EventFeeKey } from "@/lib/conference";
import type {
  ConferenceEvent,
  EarlyBirdMode,
  EventFees,
  EventRateFee,
  MembershipType,
  RegistrationRateChoice,
  AppliedFeeKey,
  FeeTier,
} from "@/lib/types/admin";
import { getDefaultEventFees } from "@/lib/types/admin";
import {
  formatDateRangeDisplay,
  formatLongDate,
  parseLooseDateToIso,
  todayIsoInTimeZone,
} from "@/lib/event-date";

export type { FeeTier, AppliedFeeKey, RegistrationRateChoice };

type LegacyFee = {
  early?: number;
  regular?: number;
  label?: string;
  amount?: number;
  cap?: number;
  mode?: EarlyBirdMode;
  windowStart?: string;
  windowEnd?: string;
  caption?: string;
};

function asAmount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : fallback;
}

function normalizeIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return parseLooseDateToIso(value.trim()) ?? undefined;
}

function normalizeRateFee(
  raw: LegacyFee | EventRateFee | undefined,
  fallback: EventRateFee
): EventRateFee {
  if (!raw || typeof raw !== "object") return { ...fallback };

  // New shape
  if ("amount" in raw && typeof (raw as EventRateFee).amount === "number") {
    const fee = raw as EventRateFee;
    const mode: EarlyBirdMode = fee.mode === "dates" ? "dates" : fallback.mode ?? "slots";
    return {
      amount: asAmount(fee.amount, fallback.amount),
      label: fee.label?.trim() || fallback.label,
      caption: fee.caption ?? fallback.caption,
      cap: typeof fee.cap === "number" ? fee.cap : fallback.cap,
      mode,
      windowStart: normalizeIsoDate(fee.windowStart) ?? fallback.windowStart,
      windowEnd: normalizeIsoDate(fee.windowEnd) ?? fallback.windowEnd,
    };
  }

  // Legacy nested early/regular — map early→earlyBird amount, regular→regular amount when converting categories.
  const legacy = raw as LegacyFee;
  return {
    amount: asAmount(legacy.regular ?? legacy.early, fallback.amount),
    label: legacy.label?.trim() || fallback.label,
    caption: fallback.caption,
    cap: fallback.cap,
    mode: fallback.mode ?? "slots",
    windowStart: fallback.windowStart,
    windowEnd: fallback.windowEnd,
  };
}

/** Normalize any stored/event fee object into the current EventFees shape. */
export function normalizeEventFees(raw: unknown): EventFees {
  const defaults = getDefaultEventFees();
  if (!raw || typeof raw !== "object") return defaults;

  const source = raw as Record<string, LegacyFee | EventRateFee>;

  // Already new shape
  if (source.earlyBird || source.regular || source.seniorPwd || source.nonMember) {
    return {
      earlyBird: normalizeRateFee(source.earlyBird, defaults.earlyBird),
      regular: normalizeRateFee(source.regular, defaults.regular),
      seniorPwd: normalizeRateFee(source.seniorPwd, defaults.seniorPwd),
      nonMember: normalizeRateFee(source.nonMember, defaults.nonMember),
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

export function getEarlyBirdMode(fees: EventFees): EarlyBirdMode {
  return fees.earlyBird.mode === "dates" ? "dates" : "slots";
}

export function getEarlyBirdCap(fees: EventFees): number {
  const cap = fees.earlyBird.cap;
  return typeof cap === "number" && cap > 0 ? Math.floor(cap) : 500;
}

/**
 * Resolve early-bird window end (YYYY-MM-DD), falling back to the event deadline string.
 */
export function getEarlyBirdWindowEnd(
  fees: EventFees,
  event?: Pick<ConferenceEvent, "earlyBirdDeadline"> | null
): string | undefined {
  return (
    normalizeIsoDate(fees.earlyBird.windowEnd) ??
    normalizeIsoDate(event?.earlyBirdDeadline ?? "") ??
    undefined
  );
}

export function getEarlyBirdWindowStart(fees: EventFees): string | undefined {
  return normalizeIsoDate(fees.earlyBird.windowStart);
}

/** Human-readable early bird eligibility caption for sidebars and fee lists. */
export function getEarlyBirdCaption(
  fees: EventFees,
  event?: Pick<ConferenceEvent, "earlyBirdDeadline"> | null
): string {
  const cap = getEarlyBirdCap(fees);
  const start = getEarlyBirdWindowStart(fees);
  const end = getEarlyBirdWindowEnd(fees, event);

  if (start && end) {
    return `First ${cap} registrants within ${formatDateRangeDisplay(start, end)} (whichever ends first)`;
  }
  if (end) {
    return `First ${cap} registrants, or until ${formatLongDate(end)} (whichever comes first)`;
  }
  if (fees.earlyBird.caption?.trim()) return fees.earlyBird.caption.trim();
  return `First ${cap} registrants only`;
}

/**
 * Early bird is available only while BOTH are true:
 * - slots remain under the configured cap (e.g. first 500)
 * - today is still within the early bird date window (if configured)
 *
 * If the date window ends with unused slots, early bird still closes.
 * If slots fill before the window ends, early bird also closes.
 */
export function isEarlyBirdAvailable(
  fees: EventFees,
  earlyBirdUsedCount: number,
  event?: Pick<ConferenceEvent, "earlyBirdDeadline"> | null,
  todayIso: string = todayIsoInTimeZone()
): boolean {
  if (earlyBirdUsedCount >= getEarlyBirdCap(fees)) return false;

  const start = getEarlyBirdWindowStart(fees);
  const end = getEarlyBirdWindowEnd(fees, event);
  if (start && todayIso < start) return false;
  if (end && todayIso > end) return false;

  return true;
}

/** Senior/PWD always mirrors the early bird amount. */
export function getSeniorPwdAmount(fees: EventFees): number {
  return fees.earlyBird.amount;
}

/**
 * Resolve what the participant will be charged.
 * - Non-members: always nonMember rate (no early bird, Senior/PWD, or regular)
 * - Members during early bird: regular choice → earlyBird (Senior/PWD is not offered)
 * - Members after early bird: regular → regular; seniorPwd → early bird amount
 */
export function resolveAppliedFee(
  rateChoice: RegistrationRateChoice,
  earlyBirdUsedCount: number,
  event?: Pick<ConferenceEvent, "fees" | "earlyBirdDeadline"> | null,
  membershipType?: MembershipType | "" | null
): { key: AppliedFeeKey; amount: number; label: string } {
  const fees = getFeesForEvent(event);
  const earlyBirdOpen = isEarlyBirdAvailable(fees, earlyBirdUsedCount, event);

  if (membershipType === "non_member") {
    return {
      key: "nonMember",
      amount: fees.nonMember.amount,
      label: fees.nonMember.label,
    };
  }

  if (rateChoice === "seniorPwd") {
    // Defensive: if submitted during early bird, charge early bird as a standard registration.
    if (earlyBirdOpen) {
      return {
        key: "earlyBird",
        amount: fees.earlyBird.amount,
        label: fees.earlyBird.label,
      };
    }
    return {
      key: "seniorPwd",
      amount: getSeniorPwdAmount(fees),
      label: fees.seniorPwd.label,
    };
  }

  if (earlyBirdOpen) {
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
  event?: Pick<ConferenceEvent, "fees" | "earlyBirdDeadline"> | null,
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
  if (key === "nonMember") return fees.nonMember.label;
  return key;
}
