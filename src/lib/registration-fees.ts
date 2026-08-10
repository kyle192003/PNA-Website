import { conference, type EventFeeKey } from "@/lib/conference";
import type {
  ConferenceEvent,
  EarlyBirdMode,
  EventFees,
  EventRateFee,
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
  if (getEarlyBirdMode(fees) === "dates") {
    const start = getEarlyBirdWindowStart(fees);
    const end = getEarlyBirdWindowEnd(fees, event);
    if (start && end) return formatDateRangeDisplay(start, end);
    if (end) return `Until ${formatLongDate(end)}`;
    if (start) return `From ${formatLongDate(start)}`;
    return "Limited-time early bird window";
  }

  if (fees.earlyBird.caption?.trim()) return fees.earlyBird.caption.trim();
  return `First ${getEarlyBirdCap(fees)} registrants only`;
}

/**
 * Whether early bird pricing is currently available.
 * - slots: used count is under the configured cap
 * - dates: today's Asia/Manila date is within the inclusive window
 */
export function isEarlyBirdAvailable(
  fees: EventFees,
  earlyBirdUsedCount: number,
  event?: Pick<ConferenceEvent, "earlyBirdDeadline"> | null,
  todayIso: string = todayIsoInTimeZone()
): boolean {
  if (getEarlyBirdMode(fees) === "dates") {
    const start = getEarlyBirdWindowStart(fees);
    const end = getEarlyBirdWindowEnd(fees, event);
    if (!end && !start) return false;
    if (start && todayIso < start) return false;
    if (end && todayIso > end) return false;
    return true;
  }

  return earlyBirdUsedCount < getEarlyBirdCap(fees);
}

/**
 * Resolve what the participant will be charged.
 * - seniorPwd → seniorPwd amount
 * - regular + early bird available → earlyBird
 * - regular otherwise → regular
 */
export function resolveAppliedFee(
  rateChoice: RegistrationRateChoice,
  earlyBirdUsedCount: number,
  event?: Pick<ConferenceEvent, "fees" | "earlyBirdDeadline"> | null
): { key: AppliedFeeKey; amount: number; label: string } {
  const fees = getFeesForEvent(event);

  if (rateChoice === "seniorPwd") {
    return {
      key: "seniorPwd",
      amount: fees.seniorPwd.amount,
      label: fees.seniorPwd.label,
    };
  }

  if (isEarlyBirdAvailable(fees, earlyBirdUsedCount, event)) {
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
  return key;
}
