import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const authenticated = verifySessionToken(token);

  return NextResponse.json({ authenticated });
}
