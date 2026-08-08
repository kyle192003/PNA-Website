import { NextResponse } from "next/server";
import { filterPhProvinces, type PhPlaceSuggestion, type PhPlaceType } from "@/lib/ph-locations";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  city_district?: string;
  county?: string;
  state?: string;
  region?: string;
};

type NominatimResult = {
  place_id: number | string;
  display_name: string;
  address?: NominatimAddress;
  type?: string;
  class?: string;
};

function pickCity(address?: NominatimAddress): string | undefined {
  return (
    address?.city ||
    address?.municipality ||
    address?.town ||
    address?.city_district ||
    address?.village ||
    address?.suburb ||
    undefined
  );
}

function pickProvince(address?: NominatimAddress): string | undefined {
  const state = address?.state || address?.region || address?.county;
  if (!state) return undefined;
  if (/metro manila|national capital/i.test(state)) return "Metro Manila";
  return state.replace(/^Province of\s+/i, "").trim();
}

function pickStreet(address?: NominatimAddress, fallback?: string): string | undefined {
  const street = address?.road || address?.pedestrian || address?.neighbourhood;
  if (street) return street;
  if (!fallback) return undefined;
  return fallback.split(",")[0]?.trim();
}

function toSuggestion(item: NominatimResult, type: PhPlaceType): PhPlaceSuggestion | null {
  const street = pickStreet(item.address, item.display_name);
  const city = pickCity(item.address);
  const province = pickProvince(item.address);

  if (type === "province") {
    if (!province) return null;
    return {
      id: String(item.place_id),
      label: province,
      province,
      city,
      street,
    };
  }

  if (type === "city") {
    if (!city) return null;
    return {
      id: String(item.place_id),
      label: province ? `${city}, ${province}` : city,
      city,
      province,
      street,
    };
  }

  const labelParts = [street, city, province].filter(Boolean);
  if (labelParts.length === 0) return null;

  return {
    id: String(item.place_id),
    label: labelParts.join(", "),
    street: street || labelParts[0],
    city,
    province,
  };
}

export async function GET(request: Request) {
  const ip = clientIpFromRequest(request);
  const limited = rateLimit(`places:${ip}`, 60, 60_000);
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfterSeconds);
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const type = (searchParams.get("type") ?? "street") as PhPlaceType;

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  if (type !== "street" && type !== "city" && type !== "province") {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }

  if (type === "province") {
    return NextResponse.json({ suggestions: filterPhProvinces(q) });
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "ph",
    limit: "8",
    q: type === "city" ? `${q}, Philippines` : q,
  });

  if (type === "city") {
    params.set("featureType", "settlement");
  }

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PNA-Website/1.0 (conference registration address assist)",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const results = (await response.json()) as NominatimResult[];
    const seen = new Set<string>();
    const suggestions: PhPlaceSuggestion[] = [];

    for (const item of results) {
      const suggestion = toSuggestion(item, type);
      if (!suggestion) continue;
      const key = suggestion.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(suggestion);
      if (suggestions.length >= 6) break;
    }

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
