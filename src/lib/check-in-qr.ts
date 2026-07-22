import { getSiteBaseUrl } from "@/lib/site-url";

/** Build QuickChart QR image URL for a check-in token (no local file write). */
export function buildCheckInQrImageUrl(token: string, size = 280): string {
  const payload = buildCheckInQrPayload(token);
  const params = new URLSearchParams({
    text: payload,
    size: String(size),
    margin: "2",
    dark: "14532d",
    light: "ffffff",
  });
  return `https://quickchart.io/qr?${params.toString()}`;
}

/** Opaque token payload preferred for scanners; includes site URL as alternate scan path. */
export function buildCheckInQrPayload(token: string): string {
  return `${getSiteBaseUrl()}/admin/check-in?t=${encodeURIComponent(token)}`;
}

export function extractCheckInTokenFromScan(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get("t") ?? url.searchParams.get("token");
    if (fromQuery) return fromQuery.trim();
  } catch {
    // Not a URL — treat as raw token
  }

  // UUID-ish or other opaque token
  if (/^[A-Za-z0-9_-]{16,}$/.test(value)) {
    return value;
  }

  return value.length >= 16 ? value : null;
}
