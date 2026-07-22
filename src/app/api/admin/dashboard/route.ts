import { NextResponse } from "next/server";
import { getAdminStats } from "@/lib/registrations";
import { getAllEvents } from "@/lib/events";

export async function GET() {
  const [stats, events] = await Promise.all([getAdminStats(), getAllEvents()]);
  return NextResponse.json({ stats, events });
}
