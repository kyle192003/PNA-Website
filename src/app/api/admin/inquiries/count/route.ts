import { NextResponse } from "next/server";
import { countNewInquiries } from "@/lib/inquiries";

export async function GET() {
  const newCount = await countNewInquiries();
  return NextResponse.json({ newCount });
}
