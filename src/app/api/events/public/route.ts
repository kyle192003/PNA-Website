import { NextResponse } from "next/server";
import { getPublicEvents } from "@/lib/events";

export async function GET() {
  const events = await getPublicEvents();
  return NextResponse.json({ events });
}
