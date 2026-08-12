import { NextResponse } from "next/server";
import { countNewInquiries } from "@/lib/inquiries";
import { requireAdminSession } from "@/lib/security/require-admin";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const newCount = await countNewInquiries();
  return NextResponse.json({ newCount });
}
