import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createSessionToken,
  getAdminSessionCookieOptions,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
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
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
