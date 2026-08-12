import "server-only";

import {
  getPublicSupabaseUrl,
  normalizeSupabaseProjectUrl,
} from "@/lib/security/public-env";

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

export function getSupabaseUrl(): string | null {
  const fromPublic = getPublicSupabaseUrl();
  if (fromPublic) return fromPublic;
  const fromServer = normalizeSupabaseProjectUrl(process.env.SUPABASE_URL);
  return fromServer || null;
}

/** Admin/service key — server only. Never expose to the browser. */
export function getSupabaseServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}
