/**
 * Browser-safe public config only.
 * Never put admin/write secrets here. Only NEXT_PUBLIC_* values belong in the client bundle.
 */

export function getPublicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

/** Optional referrer-restricted Maps/Places browser key. Never the server/admin key. */
export function getPublicMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

export function isPublicRqDevtoolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RQ_DEVTOOLS === "true";
}

export function getPublicSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
}

/** Limited public anon key. Never put the service role key here. */
export function getPublicSupabaseAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}
