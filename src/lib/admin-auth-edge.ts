import { ADMIN_COOKIE } from "@/lib/admin-auth-constants";

function getSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    process.env.ADMIN_PASSWORD ??
    "pna-admin-dev"
  );
}

function decodeToken(token: string): { payload: string; signature: string } | null {
  try {
    const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (base64.length % 4)) % 4;
    const decoded = atob(base64 + "=".repeat(padLength));
    const separator = decoded.lastIndexOf(".");
    if (separator === -1) return null;
    return {
      payload: decoded.slice(0, separator),
      signature: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function verifyAdminSessionEdge(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;

  const parts = decodeToken(token);
  if (!parts) return false;

  const expected = await signPayload(parts.payload, getSessionSecret());
  if (!timingSafeEqualHex(parts.signature, expected)) return false;

  try {
    const data = JSON.parse(parts.payload) as { admin?: boolean; exp?: number };
    return data.admin === true && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export { ADMIN_COOKIE as ADMIN_COOKIE_EDGE };
