import { NextResponse } from "next/server";
import { countParticipantsUnderReview } from "@/lib/registrations";

export async function GET() {
  const underReviewCount = await countParticipantsUnderReview();
  return NextResponse.json({ underReviewCount });
}
