/**
 * Browser-safe public config only.
 * Never put admin/write secrets here. Only NEXT_PUBLIC_* values belong in the client bundle.
 */

/** Project origin only, e.g. https://xxxx.supabase.co — never /rest/v1 or /storage/v1. */
export function normalizeSupabaseProjectUrl(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    // Users often paste the REST endpoint; the client already appends /rest/v1.
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmed
      .replace(/\/+$/, "")
      .replace(/\/rest\/v1$/i, "")
      .replace(/\/storage\/v1$/i, "")
      .replace(/\/+$/, "");
  }
}

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
  return normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** Limited public anon key. Never put the service role key here. */
export function getPublicSupabaseAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}
