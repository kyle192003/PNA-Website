import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getSigningSecret } from "@/lib/security/secrets";
import { getSiteBaseUrl } from "@/lib/site-url";

export const INQUIRY_SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type InquirySharePayload = {
  inquiryId: string;
  nonce: string;
  exp: number;
};

function signPayload(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
}

export function createInquiryShareNonce(): string {
  return randomBytes(16).toString("hex");
}

export function createInquiryShareToken(
  inquiryId: string,
  nonce: string,
  exp: number
): string {
  const payload = JSON.stringify({
    inquiryId: inquiryId.trim(),
    nonce: nonce.trim(),
    exp,
  } satisfies InquirySharePayload);
  const signature = signPayload(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function buildInquiryShareUrl(token: string): string {
  return `${getSiteBaseUrl()}/inquiry-reply?t=${encodeURIComponent(token)}`;
}

export function verifyInquiryShareToken(
  token: string | null | undefined
): { ok: true; inquiryId: string; nonce: string; exp: number } | { ok: false; error: string } {
  if (!token?.trim()) {
    return { ok: false, error: "Missing reply link. Open the link that was shared with you." };
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const separator = decoded.lastIndexOf(".");
    if (separator === -1) {
      return { ok: false, error: "Invalid reply link." };
    }

    const payload = decoded.slice(0, separator);
    const signature = decoded.slice(separator + 1);
    const expected = signPayload(payload);

    if (signature.length !== expected.length) {
      return { ok: false, error: "Invalid reply link." };
    }
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return { ok: false, error: "Invalid reply link." };
    }

    const data = JSON.parse(payload) as InquirySharePayload;
    if (!data.inquiryId || !data.nonce || typeof data.exp !== "number") {
      return { ok: false, error: "Invalid reply link." };
    }
    if (data.exp <= Date.now()) {
      return { ok: false, error: "This reply link has expired." };
    }

    return {
      ok: true,
      inquiryId: data.inquiryId,
      nonce: data.nonce,
      exp: data.exp,
    };
  } catch {
    return { ok: false, error: "Invalid reply link." };
  }
}
