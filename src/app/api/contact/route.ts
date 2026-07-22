import { NextResponse } from "next/server";
import { notifyAdminOfInquiry } from "@/lib/admin-notify";
import { createInquiry } from "@/lib/inquiries";
import { getFirstValidationError, validateContactInquiry } from "@/lib/form-validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, mobile, message } = body;

    const fieldErrors = validateContactInquiry({
      name: name ?? "",
      email: email ?? "",
      mobile: mobile ?? "",
      message: message ?? "",
    });

    const firstError = getFirstValidationError(fieldErrors);
    if (firstError) {
      return NextResponse.json({ error: firstError, fieldErrors }, { status: 400 });
    }

    const inquiry = await createInquiry({
      name,
      email,
      mobile,
      message,
    });

    const notifyResult = await notifyAdminOfInquiry({
      name,
      email,
      mobile,
      message,
      inquiryId: inquiry.id,
      createdAt: inquiry.createdAt,
    });
    if (!notifyResult.ok) {
      console.error("[contact] admin inquiry notify failed:", notifyResult.error);
    }

    return NextResponse.json(
      {
        message: "Your inquiry has been submitted successfully. We will get back to you soon.",
        inquiry: { id: inquiry.id, createdAt: inquiry.createdAt },
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
