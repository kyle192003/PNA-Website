import { getPublicSiteUrl } from "@/lib/security/public-env";

export function getSiteBaseUrl(): string {
  const fromPublic = getPublicSiteUrl();
  if (fromPublic) return fromPublic;

  const fromServer = process.env.SITE_URL?.replace(/\/$/, "");
  if (fromServer) return fromServer;

  return "http://localhost:3000";
}
