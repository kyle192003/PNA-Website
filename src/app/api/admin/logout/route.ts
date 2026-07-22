import { NextResponse } from "next/server";
import { ADMIN_COOKIE, getAdminSessionClearCookieOptions } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const response = NextResponse.json({ message: "Signed out." });
  response.cookies.set(ADMIN_COOKIE, "", getAdminSessionClearCookieOptions(request));
  return response;
}
