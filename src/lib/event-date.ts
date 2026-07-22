import type { ConferenceEvent } from "@/lib/types/admin";

/**
 * Parses the first calendar day from common display formats like:
 * "October 14 to 16, 2026", "October 14-16, 2026", "October 14, 2026"
 * Returns YYYY-MM-DD in local interpretation, or null if unparseable.
 */
export function parseEventStartDate(datesDisplay: string): string | null {
  const raw = datesDisplay.trim();
  if (!raw) return null;

  // Explicit ISO already
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const rangeMatch = raw.match(
    /^([A-Za-z]+)\s+(\d{1,2})\s*[–—-]\s*(?:[A-Za-z]+\s+)?(\d{1,2}),?\s*(\d{4})$/
  );
  if (rangeMatch) {
    const [, month, day, , year] = rangeMatch;
    return toIsoDate(`${month} ${day}, ${year}`);
  }

  const singleMatch = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (singleMatch) {
    const [, month, day, year] = singleMatch;
    return toIsoDate(`${month} ${day}, ${year}`);
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return formatIsoDate(d);
  }

  return null;
}

/**
 * Parses the last calendar day from common display formats like:
 * "October 14 to 16, 2026", "October 14-16, 2026", "October 14, 2026"
 * Returns YYYY-MM-DD in local interpretation, or null if unparseable.
 */
export function parseEventEndDate(datesDisplay: string): string | null {
  const raw = datesDisplay.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const rangeMatch = raw.match(
    /^([A-Za-z]+)\s+(\d{1,2})\s*[–—-]\s*(?:([A-Za-z]+)\s+)?(\d{1,2}),?\s*(\d{4})$/
  );
  if (rangeMatch) {
    const [, startMonth, , endMonthMaybe, endDay, year] = rangeMatch;
    const endMonth = endMonthMaybe ?? startMonth;
    return toIsoDate(`${endMonth} ${endDay}, ${year}`);
  }

  return parseEventStartDate(raw);
}

export function getEventStartDateIso(event: Pick<ConferenceEvent, "datesDisplay">): string | null {
  return parseEventStartDate(event.datesDisplay);
}

export function getEventEndDateIso(event: Pick<ConferenceEvent, "datesDisplay">): string | null {
  return parseEventEndDate(event.datesDisplay);
}

/** Calendar date YYYY-MM-DD in the given timezone (default Asia/Manila). */
export function todayIsoInTimeZone(timeZone = "Asia/Manila"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatLongDate(isoDate: string, timeZone = "Asia/Manila"): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(utc);
}

/** Builds display text like "October 14 to 16, 2026" or "October 14 to November 2, 2026". */
export function formatDateRangeDisplay(startIso: string, endIso: string): string {
  const start = parseIsoParts(startIso);
  const end = parseIsoParts(endIso || startIso);
  if (!start) return "";
  if (!end) return formatLongDate(startIso);

  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(start.y, start.m - 1, start.d, 12)));

  if (start.y === end.y && start.m === end.m && start.d === end.d) {
    return `${startLabel}, ${start.y}`;
  }

  if (start.y === end.y && start.m === end.m) {
    return `${startLabel.split(" ")[0]} ${start.d} to ${end.d}, ${start.y}`;
  }

  if (start.y === end.y) {
    const endLabel = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(end.y, end.m - 1, end.d, 12)));
    return `${startLabel} to ${endLabel}, ${start.y}`;
  }

  return `${formatLongDate(startIso)} to ${formatLongDate(endIso)}`;
}

/** Accepts ISO (YYYY-MM-DD) or long dates like "August 31, 2026". */
export function parseLooseDateToIso(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return toIsoDate(raw);
}

function parseIsoParts(iso: string): { y: number; m: number; d: number } | null {
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
  };
}

function toIsoDate(display: string): string | null {
  const parsed = Date.parse(display);
  if (Number.isNaN(parsed)) return null;
  return formatIsoDate(new Date(parsed));
}

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type ReminderWindow = "3d" | "2d" | "0d";

/** Days from today until event start (eventStart - today). */
export function daysUntilEvent(eventStartIso: string, todayIso: string): number {
  const start = Date.parse(`${eventStartIso}T12:00:00`);
  const today = Date.parse(`${todayIso}T12:00:00`);
  if (Number.isNaN(start) || Number.isNaN(today)) return Number.NaN;
  return Math.round((start - today) / (24 * 60 * 60 * 1000));
}

export function reminderWindowForDaysUntil(daysUntil: number): ReminderWindow | null {
  if (daysUntil === 3) return "3d";
  if (daysUntil === 2) return "2d";
  if (daysUntil === 0) return "0d";
  return null;
}
