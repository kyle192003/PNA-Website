import { NextResponse } from "next/server";
import { deleteInquiry, getInquiryById, updateInquiryStatus } from "@/lib/inquiries";
import type { InquiryStatus } from "@/lib/types/admin";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readJsonBody } from "@/lib/security/safe-input";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const status = parsed.data.status as InquiryStatus;

    if (status !== "new" && status !== "read") {
      return NextResponse.json({ error: "Invalid inquiry status." }, { status: 400 });
    }

    const inquiry = await updateInquiryStatus(id, status);
    if (!inquiry) {
      return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    }

    return NextResponse.json({ inquiry });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const existing = await getInquiryById(id);
    if (!existing) {
      return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    }

    await deleteInquiry(id);
    return NextResponse.json({ message: "Inquiry deleted." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
