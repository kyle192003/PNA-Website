import "server-only";

import {
  createAccountantShareLink,
  getAccountantShareLink,
  markAccountantShareWeeklySent,
  type AccountantShareStatusPayload,
} from "@/lib/accountant-share";
import { listAccountantReviewQueue } from "@/lib/accountant-review";
import { sendAccountantShareLinkEmail } from "@/lib/mail-templates";

const WEEKDAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function manilaClock(now = new Date()): { dayOfWeek: number; hour: number; dateKey: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekday = get("weekday") as (typeof WEEKDAY_KEYS)[number];
  const dayOfWeek = Math.max(0, WEEKDAY_KEYS.indexOf(weekday));
  let hour = Number.parseInt(get("hour"), 10);
  if (!Number.isFinite(hour)) hour = 0;
  // Some engines report midnight as 24.
  if (hour === 24) hour = 0;

  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
  return { dayOfWeek, hour, dateKey };
}

function lastSentDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return manilaClock(new Date(parsed)).dateKey;
}

export type AccountantWeeklySendResult = {
  attempted: boolean;
  sent: boolean;
  skippedReason?: string;
  pendingCount?: number;
  recipients?: string[];
  url?: string | null;
  expiresAt?: string | null;
};

async function ensureShareAndSend(options?: {
  reuseActiveLink?: boolean;
  notifyEmails?: string[];
  expiryDays?: number;
  expiresAt?: string | null;
  weeklySend?: Partial<import("@/lib/accountant-share").AccountantWeeklySchedule> | null;
}): Promise<{
  share: AccountantShareStatusPayload & { url: string };
  pendingCount: number;
  mail: { ok: boolean; error?: string };
}> {
  const pendingCount = (await listAccountantReviewQueue()).length;
  const share = await createAccountantShareLink({
    reuseActiveLink: options?.reuseActiveLink ?? true,
    notifyEmails: options?.notifyEmails,
    expiryDays: options?.expiryDays,
    expiresAt: options?.expiresAt,
    weeklySend: options?.weeklySend,
  });

  if (!share.notifyEmails.length) {
    return {
      share,
      pendingCount,
      mail: { ok: false, error: "No accounting emails are configured." },
    };
  }

  const mail = await sendAccountantShareLinkEmail({
    to: share.notifyEmails,
    reviewUrl: share.url,
    expiresAt: share.expiresAt ?? new Date().toISOString(),
    pendingCount,
  });

  return { share, pendingCount, mail };
}

/** Manual or API-triggered send of the accountant review link. */
export async function sendAccountantShareNow(options?: {
  createNewLink?: boolean;
  notifyEmails?: string[];
  expiryDays?: number;
  expiresAt?: string | null;
  weeklySend?: Partial<import("@/lib/accountant-share").AccountantWeeklySchedule> | null;
}): Promise<{
  ok: boolean;
  error?: string;
  share: AccountantShareStatusPayload & { url: string };
  pendingCount: number;
}> {
  const result = await ensureShareAndSend({
    reuseActiveLink: !options?.createNewLink,
    notifyEmails: options?.notifyEmails,
    expiryDays: options?.expiryDays,
    expiresAt: options?.expiresAt,
    weeklySend: options?.weeklySend,
  });

  if (!result.mail.ok) {
    return {
      ok: false,
      error: result.mail.error ?? "Could not send the accounting email.",
      share: result.share,
      pendingCount: result.pendingCount,
    };
  }

  return {
    ok: true,
    share: result.share,
    pendingCount: result.pendingCount,
  };
}

/** Cron entry: email accounting once per scheduled Manila weekday/hour. */
export async function runAccountantWeeklyShareJob(
  now = new Date()
): Promise<AccountantWeeklySendResult> {
  const current = await getAccountantShareLink();
  if (!current.weeklySend.enabled) {
    return { attempted: false, sent: false, skippedReason: "Weekly send is disabled." };
  }
  if (!current.notifyEmails.length) {
    return {
      attempted: false,
      sent: false,
      skippedReason: "No accounting emails are configured.",
    };
  }

  const clock = manilaClock(now);
  if (clock.dayOfWeek !== current.weeklySend.dayOfWeek) {
    return {
      attempted: false,
      sent: false,
      skippedReason: "Not the scheduled weekday (Asia/Manila).",
    };
  }
  if (clock.hour !== current.weeklySend.hour) {
    return {
      attempted: false,
      sent: false,
      skippedReason: "Not the scheduled hour (Asia/Manila).",
    };
  }
  if (lastSentDateKey(current.weeklySend.lastSentAt) === clock.dateKey) {
    return {
      attempted: false,
      sent: false,
      skippedReason: "Already sent today (Asia/Manila).",
      recipients: current.notifyEmails,
      url: current.url,
      expiresAt: current.expiresAt,
    };
  }

  const result = await ensureShareAndSend({ reuseActiveLink: true });
  if (!result.mail.ok) {
    return {
      attempted: true,
      sent: false,
      skippedReason: result.mail.error ?? "Email send failed.",
      pendingCount: result.pendingCount,
      recipients: result.share.notifyEmails,
      url: result.share.url,
      expiresAt: result.share.expiresAt,
    };
  }

  await markAccountantShareWeeklySent(now);
  return {
    attempted: true,
    sent: true,
    pendingCount: result.pendingCount,
    recipients: result.share.notifyEmails,
    url: result.share.url,
    expiresAt: result.share.expiresAt,
  };
}
