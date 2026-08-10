import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const authenticated = verifySessionToken(token);

  const response = NextResponse.json({ authenticated });
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  return response;
}
