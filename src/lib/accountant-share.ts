import "server-only";

import { readJsonDocument, writeJsonDocument } from "@/lib/json-store";
import {
  ACCOUNTANT_SHARE_TTL_MS,
  buildAccountantShareUrl,
  createAccountantShareNonce,
  createAccountantShareToken,
  verifyAccountantShareToken,
} from "@/lib/accountant-share-token";

const FILENAME = "accountant-share.json";

export type AccountantShareRecord = {
  nonce: string;
  createdAt: string;
  expiresAt: string;
  notifyEmail: string | null;
};

export type AccountantSharePublicStatus = "active" | "expired" | null;

function normalizeShare(raw: AccountantShareRecord | null): AccountantShareRecord | null {
  if (!raw?.nonce || !raw.createdAt || !raw.expiresAt) return null;
  return {
    nonce: String(raw.nonce),
    createdAt: String(raw.createdAt),
    expiresAt: String(raw.expiresAt),
    notifyEmail: raw.notifyEmail ? String(raw.notifyEmail).trim().toLowerCase() : null,
  };
}

export function getAccountantShareStatus(
  share: AccountantShareRecord | null
): AccountantSharePublicStatus {
  if (!share) return null;
  if (Date.parse(share.expiresAt) <= Date.now()) return "expired";
  return "active";
}

async function readShare(): Promise<AccountantShareRecord | null> {
  const parsed = await readJsonDocument<AccountantShareRecord | null>(FILENAME, null);
  return normalizeShare(parsed);
}

async function writeShare(share: AccountantShareRecord | null): Promise<void> {
  await writeJsonDocument(FILENAME, share);
}

function buildUrl(share: AccountantShareRecord): string {
  return buildAccountantShareUrl(
    createAccountantShareToken(share.nonce, Date.parse(share.expiresAt))
  );
}

export async function createAccountantShareLink(notifyEmail?: string | null): Promise<{
  url: string;
  expiresAt: string;
  notifyEmail: string | null;
}> {
  const now = new Date();
  const share: AccountantShareRecord = {
    nonce: createAccountantShareNonce(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ACCOUNTANT_SHARE_TTL_MS).toISOString(),
    notifyEmail: notifyEmail?.trim().toLowerCase() || null,
  };
  await writeShare(share);
  return {
    url: buildUrl(share),
    expiresAt: share.expiresAt,
    notifyEmail: share.notifyEmail,
  };
}

export async function getAccountantShareLink(): Promise<{
  url: string | null;
  status: AccountantSharePublicStatus;
  expiresAt: string | null;
  notifyEmail: string | null;
}> {
  const share = await readShare();
  const status = getAccountantShareStatus(share);
  return {
    url: status === "active" && share ? buildUrl(share) : null,
    status,
    expiresAt: share?.expiresAt ?? null,
    notifyEmail: share?.notifyEmail ?? null,
  };
}

export async function requireActiveAccountantShare(
  nonce: string
): Promise<{ ok: true; share: AccountantShareRecord } | { ok: false; error: string; status: 410 }> {
  const share = await readShare();
  if (!share || share.nonce !== nonce) {
    return { ok: false, error: "This accountant review link is no longer valid.", status: 410 };
  }
  if (getAccountantShareStatus(share) !== "active") {
    return { ok: false, error: "This accountant review link has expired.", status: 410 };
  }
  return { ok: true, share };
}

export async function getAccountantNotifyEmail(): Promise<string | null> {
  const share = await readShare();
  if (getAccountantShareStatus(share) !== "active") return share?.notifyEmail ?? null;
  return share?.notifyEmail ?? null;
}

export async function getActiveAccountantReviewUrl(): Promise<string | null> {
  const current = await getAccountantShareLink();
  return current.url;
}

export function tokenFromSearch(request: Request, bodyToken?: string): string | undefined {
  const { searchParams } = new URL(request.url);
  return searchParams.get("t")?.trim() || bodyToken?.trim() || undefined;
}

export async function authorizeAccountantToken(token: string | null | undefined) {
  const verified = verifyAccountantShareToken(token);
  if (!verified.ok) {
    return { ok: false as const, error: verified.error, status: 400 as const };
  }
  const active = await requireActiveAccountantShare(verified.nonce);
  if (!active.ok) {
    return { ok: false as const, error: active.error, status: active.status };
  }
  return { ok: true as const, share: active.share };
}
