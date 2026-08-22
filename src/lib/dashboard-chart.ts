export interface DashboardChartPoint {
  label: string;
  value: number;
}

const DEFAULT_TZ = "Asia/Manila";

/** Calendar date YYYY-MM-DD in the given timezone. */
export function dateKeyInTimeZone(date: Date, timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Shift a YYYY-MM-DD calendar date by `days` (negative = past). */
export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const utc = new Date(Date.UTC(year, month - 1, day + days, 12));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekdayLabelForIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

/**
 * Build a last-N-days series keyed by Asia/Manila calendar dates
 * so SSR (often UTC) still matches Philippine local days.
 */
export function buildDailySeries(
  entries: Array<{ at: string; amount?: number }>,
  dayCount = 7,
  timeZone = DEFAULT_TZ
): DashboardChartPoint[] {
  const today = dateKeyInTimeZone(new Date(), timeZone);
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const key = dateKeyInTimeZone(new Date(entry.at), timeZone);
    totals.set(key, (totals.get(key) ?? 0) + (entry.amount ?? 1));
  }

  const points: DashboardChartPoint[] = [];
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const key = shiftIsoDate(today, -offset);
    points.push({
      label: weekdayLabelForIsoDate(key),
      value: totals.get(key) ?? 0,
    });
  }
  return points;
}
