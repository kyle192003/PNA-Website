import { authorizeAccountantToken, tokenFromSearch } from "@/lib/accountant-share";
import { listAccountantReviewQueue } from "@/lib/accountant-review";
import { RECEIPT_ISSUE_REASONS } from "@/lib/receipt-issue-reasons";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeAccountantToken(tokenFromSearch(request));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const queue = await listAccountantReviewQueue();
  return NextResponse.json({
    expiresAt: auth.share.expiresAt,
    reviewWindowNote:
      "Please review these payments within 3-5 days of submission. Approving a payment is irreversible.",
    reasons: RECEIPT_ISSUE_REASONS,
    queue,
  });
}
