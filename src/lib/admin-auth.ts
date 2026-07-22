import { createHmac, timingSafeEqual } from "crypto";
import { ADMIN_COOKIE } from "@/lib/admin-auth-constants";
import { verifyAdminPassword as verifyStoredAdminPassword } from "@/lib/admin-credentials";

export { ADMIN_COOKIE };
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type AdminCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

function getSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    process.env.ADMIN_PASSWORD ??
    "pna-admin-dev"
  );
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  return verifyStoredAdminPassword(password);
}

export function createSessionToken(): string {
  const payload = JSON.stringify({
    admin: true,
    exp: Date.now() + SESSION_DURATION_MS,
  });
  const signature = createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const separator = decoded.lastIndexOf(".");
    if (separator === -1) return false;

    const payload = decoded.slice(0, separator);
    const signature = decoded.slice(separator + 1);
    const expected = createHmac("sha256", getSessionSecret()).update(payload).digest("hex");

    if (signature.length !== expected.length) return false;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

    const data = JSON.parse(payload) as { admin?: boolean; exp?: number };
    return data.admin === true && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

/** True when the client hit us over HTTPS (incl. tunnels via x-forwarded-proto). */
export function isHttpsRequest(request: Request): boolean {
  if (request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https") {
    return true;
  }
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function getAdminSessionCookieOptions(request?: Request): AdminCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    // Mobile Safari drops non-Secure cookies on HTTPS (e.g. localtunnel / ngrok).
    secure: process.env.NODE_ENV === "production" || (request ? isHttpsRequest(request) : false),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function getAdminSessionClearCookieOptions(request?: Request): AdminCookieOptions {
  return {
    ...getAdminSessionCookieOptions(request),
    maxAge: 0,
  };
}
