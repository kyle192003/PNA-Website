import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createSessionToken,
  getAdminSessionCookieOptions,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = rateLimit(`admin-login:${ip}`, 5, 15 * 60_000);
    if (!limited.ok) {
      return rateLimitResponse(
        limited.retryAfterSeconds,
        "Too many login attempts. Please wait and try again."
      );
    }

    const body = await request.json();
    const password = body.password?.trim();

    if (!password || !(await verifyAdminPassword(password))) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }

    const response = NextResponse.json({ message: "Signed in." });
    response.cookies.set(
      ADMIN_COOKIE,
      createSessionToken(),
      getAdminSessionCookieOptions(request)
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Missing ADMIN_SESSION_SECRET") || message.includes("Refusing to sign")) {
      return NextResponse.json(
        { error: "Admin authentication is misconfigured on the server." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
