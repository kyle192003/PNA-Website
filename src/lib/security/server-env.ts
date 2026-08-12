import "server-only";

/**
 * Admin / write credentials. Importing this file from a Client Component fails the build.
 */

export function getBlobReadWriteToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

export function getBlobStoreAccess(): "public" | "private" {
  const configured = process.env.BLOB_STORE_ACCESS?.trim().toLowerCase();
  if (configured === "private" || configured === "public") return configured;
  return "public";
}

export function getWeb3FormsAccessKey(): string | null {
  return process.env.WEB3FORMS_ACCESS_KEY?.trim() || null;
}

export function getCronSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || null;
}

export function getAdminNotifyEmail(): string | null {
  return process.env.ADMIN_NOTIFY_EMAIL?.trim() || null;
}

/** IP-restricted Maps/Places server key. Never expose this to the browser. */
export function getGoogleMapsServerApiKey(): string | null {
  return process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() || null;
}

export function cronSecretMatches(authorizationHeader: string | null): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  return authorizationHeader === `Bearer ${secret}`;
}
