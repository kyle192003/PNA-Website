import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-auth";

export function unauthorizedAdminResponse() {
  return NextResponse.json(
    { error: "Unauthorized." },
    {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

/**
 * In-handler admin gate. Middleware is not enough — verify the session
 * cookie before returning or mutating any admin data.
 */
export async function requireAdminSession(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    return { ok: false, response: unauthorizedAdminResponse() };
  }
  return { ok: true };
}
