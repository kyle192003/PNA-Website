/**
 * Shared secret resolution for admin sessions and signed tokens.
 * Production fails closed — never use the local default password as a signing secret.
 */

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Local-only fallback. Never used when NODE_ENV=production. */
const DEV_FALLBACK_SECRET = "pna-admin-dev";

/**
 * Secret used to sign admin session cookies and receipt reupload tokens.
 * Prefer ADMIN_SESSION_SECRET; fall back to ADMIN_PASSWORD only outside production.
 */
export function getSigningSecret(): string {
  const dedicated = process.env.ADMIN_SESSION_SECRET?.trim();
  if (dedicated) return dedicated;

  const password = process.env.ADMIN_PASSWORD?.trim();
  if (password) {
    if (isProductionRuntime()) {
      // Still usable, but operators should set ADMIN_SESSION_SECRET separately.
      return password;
    }
    return password;
  }

  if (isProductionRuntime()) {
    throw new Error(
      "Missing ADMIN_SESSION_SECRET or ADMIN_PASSWORD. Refusing to sign tokens in production."
    );
  }

  return DEV_FALLBACK_SECRET;
}

/** Safe for Edge: returns null instead of throwing when misconfigured in production. */
export function getSigningSecretOrNull(): string | null {
  try {
    return getSigningSecret();
  } catch {
    return null;
  }
}

export function getAdminPasswordOrNull(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (password) return password;
  if (isProductionRuntime()) return null;
  return DEV_FALLBACK_SECRET;
}
