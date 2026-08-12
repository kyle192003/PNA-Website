import { NextResponse } from "next/server";
import { getAdminStats } from "@/lib/registrations";
import { getAllEvents } from "@/lib/events";
import { requireAdminSession } from "@/lib/security/require-admin";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const [stats, events] = await Promise.all([getAdminStats(), getAllEvents()]);
  return NextResponse.json({ stats, events });
}
