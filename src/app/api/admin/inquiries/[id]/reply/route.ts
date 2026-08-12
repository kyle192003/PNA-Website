import { NextResponse } from "next/server";
import { addInquiryReply, getInquiryById } from "@/lib/inquiries";
import { sendInquiryReplyEmail } from "@/lib/mail-templates";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readJsonBody, stringField } from "@/lib/security/safe-input";

export const dynamic = "force-dynamic";

const MAX_REPLY_LENGTH = 5000;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Inquiry id is required." }, { status: 400 });
    }

    const inquiry = await getInquiryById(id.trim());
    if (!inquiry) {
      return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    }

    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const replyBody = stringField(parsed.data.message)?.trim() ?? "";
    if (!replyBody) {
      return NextResponse.json({ error: "Reply message is required." }, { status: 400 });
    }
    if (replyBody.length > MAX_REPLY_LENGTH) {
      return NextResponse.json(
        { error: `Reply must be ${MAX_REPLY_LENGTH} characters or fewer.` },
        { status: 400 }
      );
    }

    const mail = await sendInquiryReplyEmail({
      name: inquiry.name,
      email: inquiry.email,
      originalMessage: inquiry.message,
      replyBody,
    });

    if (!mail.ok) {
      return NextResponse.json(
        {
          error:
            mail.error ||
            "Could not send the reply email. Check SMTP settings and try again.",
        },
        { status: 502 }
      );
    }

    const updated = await addInquiryReply(inquiry.id, replyBody);
    if (!updated) {
      return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
    }

    return NextResponse.json({
      inquiry: updated,
      message: "Reply sent using the website email template.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
