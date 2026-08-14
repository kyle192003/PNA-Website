import { NextResponse } from "next/server";
import { createInquiryShareLink, getInquiryShareLink } from "@/lib/inquiries";
import { requireAdminSession } from "@/lib/security/require-admin";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Inquiry id is required." }, { status: 400 });
    }

    const result = await getInquiryShareLink(id.trim());
    if (!result) {
      return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    }

    return NextResponse.json({
      inquiry: result.inquiry,
      url: result.url,
      status: result.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Inquiry id is required." }, { status: 400 });
    }

    const result = await createInquiryShareLink(id.trim());
    if (!result) {
      return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    }

    return NextResponse.json({
      inquiry: result.inquiry,
      url: result.url,
      expiresAt: result.expiresAt,
      message: "Share link created. It expires after one reply or after 7 days.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
