import { NextResponse } from "next/server";
import { countParticipantsUnderReview } from "@/lib/registrations";
import { requireAdminSession } from "@/lib/security/require-admin";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const underReviewCount = await countParticipantsUnderReview();
  return NextResponse.json({ underReviewCount });
}
