const QUICKCHART_QR_BASE = "https://quickchart.io/qr";

export function getClientSiteBaseUrl(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export function buildEventRegistrationUrl(eventId: string, baseUrl?: string): string {
  const siteBase = (baseUrl ?? getClientSiteBaseUrl()).replace(/\/$/, "");
  const params = new URLSearchParams({
    register: "1",
    event: eventId,
  });
  return `${siteBase}/?${params.toString()}`;
}

export function buildQuickChartQrUrl(
  text: string,
  options?: { size?: number; margin?: number; caption?: string }
): string {
  const params = new URLSearchParams({
    text,
    size: String(options?.size ?? 400),
    margin: String(options?.margin ?? 2),
    ecLevel: "M",
    format: "png",
  });

  if (options?.caption) {
    params.set("caption", options.caption);
  }

  return `${QUICKCHART_QR_BASE}?${params.toString()}`;
}

export function buildRegistrationQrDetails(
  eventId: string,
  eventTitle: string,
  qrCodeUrl: string,
  baseUrl?: string
) {
  const registrationUrl = buildEventRegistrationUrl(eventId, baseUrl);

  return {
    registrationUrl,
    qrCodeUrl,
    quickChartUrl: buildQuickChartQrUrl(registrationUrl, {
      size: 600,
      caption: eventTitle,
    }),
  };
}
