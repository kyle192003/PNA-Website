import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getSigningSecret } from "@/lib/security/secrets";
import { getSiteBaseUrl } from "@/lib/site-url";

export const ACCOUNTANT_SHARE_DEFAULT_EXPIRY_DAYS = 5;
export const ACCOUNTANT_SHARE_MIN_EXPIRY_DAYS = 1;
export const ACCOUNTANT_SHARE_MAX_EXPIRY_DAYS = 30;
/** @deprecated Prefer configurable expiryDays on the share record. */
export const ACCOUNTANT_SHARE_TTL_MS =
  ACCOUNTANT_SHARE_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
export const ACCOUNTANT_SHARE_PATH = "/a";

type AccountantSharePayload = {
  nonce: string;
  exp: number;
};

function signPayload(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
}

export function createAccountantShareNonce(): string {
  return randomBytes(8).toString("base64url");
}

export function createAccountantShareToken(nonce: string, exp: number): string {
  const payload = JSON.stringify({
    nonce: nonce.trim(),
    exp,
  } satisfies AccountantSharePayload);
  const signature = signPayload(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function buildAccountantShareUrl(code: string): string {
  return `${getSiteBaseUrl()}${ACCOUNTANT_SHARE_PATH}/${encodeURIComponent(code)}`;
}

export function verifyAccountantShareToken(
  token: string | null | undefined
): { ok: true; nonce: string; exp: number } | { ok: false; error: string } {
  if (!token?.trim()) {
    return { ok: false, error: "Missing review link. Open the link that was shared with you." };
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const separator = decoded.lastIndexOf(".");
    if (separator === -1) {
      return { ok: false, error: "Invalid review link." };
    }

    const payload = decoded.slice(0, separator);
    const signature = decoded.slice(separator + 1);
    const expected = signPayload(payload);

    if (signature.length !== expected.length) {
      return { ok: false, error: "Invalid review link." };
    }
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return { ok: false, error: "Invalid review link." };
    }

    const data = JSON.parse(payload) as AccountantSharePayload;
    if (!data.nonce || typeof data.exp !== "number") {
      return { ok: false, error: "Invalid review link." };
    }
    if (data.exp <= Date.now()) {
      return { ok: false, error: "This accountant review link has expired." };
    }

    return { ok: true, nonce: data.nonce, exp: data.exp };
  } catch {
    return { ok: false, error: "Invalid review link." };
  }
}
