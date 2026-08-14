import { NextResponse } from "next/server";
import { getAllInquiries } from "@/lib/inquiries";
import type { InquiryStatus } from "@/lib/types/admin";
import { requireAdminSession } from "@/lib/security/require-admin";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as InquiryStatus | null;
  const query = searchParams.get("q")?.toLowerCase().trim();

  let inquiries = await getAllInquiries();

  if (status === "new" || status === "read" || status === "replied") {
    inquiries = inquiries.filter((inquiry) => inquiry.status === status);
  }

  if (query) {
    inquiries = inquiries.filter((inquiry) => {
      const haystack = [
        inquiry.name,
        inquiry.email,
        inquiry.company,
        inquiry.mobile,
        inquiry.message,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  return NextResponse.json({ inquiries });
}
