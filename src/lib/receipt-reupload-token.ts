import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { getSigningSecret } from "@/lib/security/secrets";

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type ReceiptReuploadPayload = {
  referenceNumber: string;
  exp: number;
};

function getTokenSecret(): string {
  return getSigningSecret();
}

function signPayload(payload: string): string {
  return createHmac("sha256", getTokenSecret()).update(payload).digest("hex");
}

export function createReceiptReuploadToken(referenceNumber: string): string {
  const payload = JSON.stringify({
    referenceNumber: referenceNumber.trim().toUpperCase(),
    exp: Date.now() + TOKEN_TTL_MS,
  } satisfies ReceiptReuploadPayload);
  const signature = signPayload(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyReceiptReuploadToken(
  token: string | null | undefined
): { ok: true; referenceNumber: string } | { ok: false; error: string } {
  if (!token?.trim()) {
    return { ok: false, error: "Missing reupload link. Open the link from your email." };
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const separator = decoded.lastIndexOf(".");
    if (separator === -1) {
      return { ok: false, error: "Invalid reupload link." };
    }

    const payload = decoded.slice(0, separator);
    const signature = decoded.slice(separator + 1);
    const expected = signPayload(payload);

    if (signature.length !== expected.length) {
      return { ok: false, error: "Invalid reupload link." };
    }
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return { ok: false, error: "Invalid reupload link." };
    }

    const data = JSON.parse(payload) as ReceiptReuploadPayload;
    if (!data.referenceNumber || typeof data.exp !== "number") {
      return { ok: false, error: "Invalid reupload link." };
    }
    if (data.exp <= Date.now()) {
      return { ok: false, error: "This reupload link has expired. Contact the secretariat for a new one." };
    }

    return { ok: true, referenceNumber: data.referenceNumber };
  } catch {
    return { ok: false, error: "Invalid reupload link." };
  }
}
