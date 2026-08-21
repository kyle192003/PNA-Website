import "server-only";

import { readJsonDocument, writeJsonDocument } from "@/lib/json-store";
import {
  ACCOUNTANT_SHARE_DEFAULT_EXPIRY_DAYS,
  ACCOUNTANT_SHARE_MAX_EXPIRY_DAYS,
  ACCOUNTANT_SHARE_MIN_EXPIRY_DAYS,
  buildAccountantShareUrl,
  createAccountantShareNonce,
  verifyAccountantShareToken,
} from "@/lib/accountant-share-token";

const FILENAME = "accountant-share.json";

export type AccountantWeeklySchedule = {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday (Asia/Manila). */
  dayOfWeek: number;
  /** 0–23 hour in Asia/Manila. */
  hour: number;
  lastSentAt: string | null;
};

export type AccountantShareRecord = {
  nonce: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  /** @deprecated Prefer notifyEmails; kept for older stored documents. */
  notifyEmail: string | null;
  notifyEmails: string[];
  expiryDays: number;
  weeklySend: AccountantWeeklySchedule;
};

export type AccountantSharePublicStatus = "active" | "expired" | null;

export type AccountantShareStatusPayload = {
  url: string | null;
  status: AccountantSharePublicStatus;
  expiresAt: string | null;
  notifyEmail: string | null;
  notifyEmails: string[];
  expiryDays: number;
  weeklySend: AccountantWeeklySchedule;
};

export type CreateAccountantShareOptions = {
  notifyEmails?: string[];
  expiryDays?: number;
  /** Absolute expiry instant (ISO). Takes precedence over expiryDays when valid and in the future. */
  expiresAt?: string | null;
  weeklySend?: Partial<AccountantWeeklySchedule> | null;
  /** When true, keep the existing nonce if still active and only refresh expiry/settings. */
  reuseActiveLink?: boolean;
};

const DEFAULT_WEEKLY: AccountantWeeklySchedule = {
  enabled: false,
  dayOfWeek: 1,
  hour: 9,
  lastSentAt: null,
};

function clampExpiryDays(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return ACCOUNTANT_SHARE_DEFAULT_EXPIRY_DAYS;
  }
  return Math.min(
    ACCOUNTANT_SHARE_MAX_EXPIRY_DAYS,
    Math.max(ACCOUNTANT_SHARE_MIN_EXPIRY_DAYS, Math.round(value))
  );
}

function clampDayOfWeek(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(6, Math.max(0, Math.round(value)));
}

function clampHour(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 9;
  return Math.min(23, Math.max(0, Math.round(value)));
}

function normalizeEmails(raw: unknown): string[] {
  const list: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) list.push(item.trim().toLowerCase());
    }
  } else if (typeof raw === "string" && raw.trim()) {
    list.push(raw.trim().toLowerCase());
  }
  return Array.from(new Set(list));
}

function normalizeWeekly(
  raw: Partial<AccountantWeeklySchedule> | null | undefined,
  fallback: AccountantWeeklySchedule = DEFAULT_WEEKLY
): AccountantWeeklySchedule {
  return {
    enabled: typeof raw?.enabled === "boolean" ? raw.enabled : fallback.enabled,
    dayOfWeek: clampDayOfWeek(
      typeof raw?.dayOfWeek === "number" ? raw.dayOfWeek : fallback.dayOfWeek
    ),
    hour: clampHour(typeof raw?.hour === "number" ? raw.hour : fallback.hour),
    lastSentAt:
      typeof raw?.lastSentAt === "string" && raw.lastSentAt.trim()
        ? raw.lastSentAt
        : fallback.lastSentAt,
  };
}

function emptyShare(): AccountantShareRecord {
  return {
    nonce: null,
    createdAt: null,
    expiresAt: null,
    notifyEmail: null,
    notifyEmails: [],
    expiryDays: ACCOUNTANT_SHARE_DEFAULT_EXPIRY_DAYS,
    weeklySend: { ...DEFAULT_WEEKLY },
  };
}

function normalizeShare(raw: AccountantShareRecord | null): AccountantShareRecord {
  if (!raw || typeof raw !== "object") return emptyShare();

  const legacyEmail =
    typeof raw.notifyEmail === "string" && raw.notifyEmail.trim()
      ? raw.notifyEmail.trim().toLowerCase()
      : null;
  const notifyEmails = normalizeEmails(
    Array.isArray(raw.notifyEmails) && raw.notifyEmails.length
      ? raw.notifyEmails
      : legacyEmail
        ? [legacyEmail]
        : []
  );

  return {
    nonce: raw.nonce ? String(raw.nonce) : null,
    createdAt: raw.createdAt ? String(raw.createdAt) : null,
    expiresAt: raw.expiresAt ? String(raw.expiresAt) : null,
    notifyEmail: notifyEmails[0] ?? null,
    notifyEmails,
    expiryDays: clampExpiryDays(
      typeof raw.expiryDays === "number" ? raw.expiryDays : ACCOUNTANT_SHARE_DEFAULT_EXPIRY_DAYS
    ),
    weeklySend: normalizeWeekly(raw.weeklySend),
  };
}

export function getAccountantShareStatus(
  share: AccountantShareRecord | null
): AccountantSharePublicStatus {
  if (!share?.nonce || !share.expiresAt) return null;
  if (Date.parse(share.expiresAt) <= Date.now()) return "expired";
  return "active";
}

async function readShare(): Promise<AccountantShareRecord> {
  const parsed = await readJsonDocument<AccountantShareRecord | null>(FILENAME, null);
  return normalizeShare(parsed);
}

async function writeShare(share: AccountantShareRecord): Promise<void> {
  await writeJsonDocument(FILENAME, normalizeShare(share));
}

function buildUrl(nonce: string): string {
  return buildAccountantShareUrl(nonce);
}

function toStatusPayload(share: AccountantShareRecord): AccountantShareStatusPayload {
  const status = getAccountantShareStatus(share);
  return {
    url: status === "active" && share.nonce ? buildUrl(share.nonce) : null,
    status,
    expiresAt: share.expiresAt,
    notifyEmail: share.notifyEmails[0] ?? null,
    notifyEmails: share.notifyEmails,
    expiryDays: share.expiryDays,
    weeklySend: share.weeklySend,
  };
}

export async function getAccountantShareLink(): Promise<AccountantShareStatusPayload> {
  const share = await readShare();
  return toStatusPayload(share);
}

export async function updateAccountantShareSettings(input: {
  notifyEmails?: string[];
  expiryDays?: number;
  expiresAt?: string | null;
  weeklySend?: Partial<AccountantWeeklySchedule> | null;
}): Promise<AccountantShareStatusPayload> {
  const share = await readShare();

  if (input.notifyEmails !== undefined) {
    share.notifyEmails = normalizeEmails(input.notifyEmails);
    share.notifyEmail = share.notifyEmails[0] ?? null;
  }
  if (input.expiryDays !== undefined) {
    share.expiryDays = clampExpiryDays(input.expiryDays);
  }
  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    const parsed = Date.parse(input.expiresAt);
    if (Number.isFinite(parsed) && parsed > Date.now()) {
      share.expiresAt = new Date(parsed).toISOString();
      const ms = parsed - Date.now();
      share.expiryDays = clampExpiryDays(Math.ceil(ms / (24 * 60 * 60 * 1000)));
    }
  }
  if (input.weeklySend !== undefined && input.weeklySend !== null) {
    share.weeklySend = normalizeWeekly(input.weeklySend, share.weeklySend);
  }

  await writeShare(share);
  return toStatusPayload(share);
}

export async function createAccountantShareLink(
  options: CreateAccountantShareOptions = {}
): Promise<AccountantShareStatusPayload & { url: string }> {
  const existing = await readShare();
  const notifyEmails =
    options.notifyEmails !== undefined
      ? normalizeEmails(options.notifyEmails)
      : existing.notifyEmails;

  let expiryDays = clampExpiryDays(
    options.expiryDays !== undefined ? options.expiryDays : existing.expiryDays
  );
  let expiresAtMs = Date.now() + expiryDays * 24 * 60 * 60 * 1000;

  if (options.expiresAt) {
    const parsed = Date.parse(options.expiresAt);
    if (Number.isFinite(parsed) && parsed > Date.now()) {
      expiresAtMs = parsed;
      expiryDays = clampExpiryDays(Math.ceil((parsed - Date.now()) / (24 * 60 * 60 * 1000)));
    }
  }

  const weeklySend =
    options.weeklySend !== undefined && options.weeklySend !== null
      ? normalizeWeekly(options.weeklySend, existing.weeklySend)
      : existing.weeklySend;

  const now = new Date();
  const reuse =
    options.reuseActiveLink &&
    getAccountantShareStatus(existing) === "active" &&
    existing.nonce;

  const share: AccountantShareRecord = {
    nonce: reuse ? existing.nonce : createAccountantShareNonce(),
    createdAt: reuse && existing.createdAt ? existing.createdAt : now.toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    notifyEmail: notifyEmails[0] ?? null,
    notifyEmails,
    expiryDays,
    weeklySend,
  };

  await writeShare(share);
  if (!share.nonce) {
    throw new Error("Could not create accountant review link.");
  }

  return {
    ...toStatusPayload(share),
    url: buildUrl(share.nonce),
  };
}

/**
 * Guarantees a non-expired review URL before emailing accounting.
 * Renews automatically when the current link is missing or expired.
 */
export async function ensureFreshAccountantShareForEmail(
  options: CreateAccountantShareOptions = {}
): Promise<AccountantShareStatusPayload & { url: string; renewed: boolean }> {
  const current = await getAccountantShareLink();
  const isActive = current.status === "active" && Boolean(current.url);
  const forceNew = options.reuseActiveLink === false;

  // Expired / missing links must never be emailed — mint a fresh URL.
  if (!isActive || forceNew) {
    const renewed = await createAccountantShareLink({
      ...options,
      reuseActiveLink: false,
    });
    return { ...renewed, renewed: true };
  }

  const refreshed = await createAccountantShareLink({
    ...options,
    reuseActiveLink: true,
  });
  return { ...refreshed, renewed: false };
}

export async function markAccountantShareWeeklySent(at = new Date()): Promise<void> {
  const share = await readShare();
  share.weeklySend = {
    ...share.weeklySend,
    lastSentAt: at.toISOString(),
  };
  await writeShare(share);
}

export async function requireActiveAccountantShare(
  nonce: string
): Promise<{ ok: true; share: AccountantShareRecord } | { ok: false; error: string; status: 410 }> {
  const share = await readShare();
  if (!share.nonce || share.nonce !== nonce) {
    return { ok: false, error: "This accountant review link is no longer valid.", status: 410 };
  }
  if (getAccountantShareStatus(share) !== "active") {
    return { ok: false, error: "This accountant review link has expired.", status: 410 };
  }
  return { ok: true, share };
}

export async function getAccountantNotifyEmails(): Promise<string[]> {
  const share = await readShare();
  return share.notifyEmails;
}

/** @deprecated Use getAccountantNotifyEmails */
export async function getAccountantNotifyEmail(): Promise<string | null> {
  const emails = await getAccountantNotifyEmails();
  return emails[0] ?? null;
}

export async function getActiveAccountantReviewUrl(): Promise<string | null> {
  const current = await getAccountantShareLink();
  return current.url;
}

export function tokenFromSearch(request: Request, bodyToken?: string): string | undefined {
  const { searchParams } = new URL(request.url);
  return searchParams.get("t")?.trim() || bodyToken?.trim() || undefined;
}

const LEGACY_SIGNED_TOKEN_MIN_LENGTH = 40;

export async function authorizeAccountantToken(token: string | null | undefined) {
  if (!token?.trim()) {
    return {
      ok: false as const,
      error: "Missing review link. Open the link that was shared with you.",
      status: 400 as const,
    };
  }

  const trimmed = token.trim();
  if (trimmed.length >= LEGACY_SIGNED_TOKEN_MIN_LENGTH) {
    const verified = verifyAccountantShareToken(trimmed);
    if (!verified.ok) {
      return { ok: false as const, error: verified.error, status: 400 as const };
    }
    const active = await requireActiveAccountantShare(verified.nonce);
    if (!active.ok) {
      return { ok: false as const, error: active.error, status: active.status };
    }
    return { ok: true as const, share: active.share };
  }

  const active = await requireActiveAccountantShare(trimmed);
  if (!active.ok) {
    return { ok: false as const, error: active.error, status: active.status };
  }
  return { ok: true as const, share: active.share };
}

export function parseEmailList(raw: unknown): string[] {
  if (Array.isArray(raw)) return normalizeEmails(raw);
  if (typeof raw !== "string") return [];
  return normalizeEmails(
    raw
      .split(/[\n,;]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}
