import { NextResponse } from "next/server";
import { notifyAdminOfInquiry } from "@/lib/admin-notify";
import { createInquiry } from "@/lib/inquiries";
import { getFirstValidationError, validateContactInquiry } from "@/lib/form-validation";
import {
  clientIpFromRequest,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { readJsonBody } from "@/lib/security/safe-input";

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const limited = rateLimit(`contact:${ip}`, 8, 60_000);
    if (!limited.ok) {
      return rateLimitResponse(limited.retryAfterSeconds);
    }

    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const name = typeof parsed.data.name === "string" ? parsed.data.name : "";
    const email = typeof parsed.data.email === "string" ? parsed.data.email : "";
    const mobile = typeof parsed.data.mobile === "string" ? parsed.data.mobile : "";
    const message = typeof parsed.data.message === "string" ? parsed.data.message : "";

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
    console.error("[contact]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
