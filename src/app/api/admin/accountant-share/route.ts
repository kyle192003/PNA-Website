import { NextResponse } from "next/server";
import { createAccountantShareLink, getAccountantShareLink } from "@/lib/accountant-share";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readJsonBody, stringField } from "@/lib/security/safe-input";
import { getEmailValidationError } from "@/lib/form-validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const result = await getAccountantShareLink();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    let notifyEmail: string | null = null;
    const parsed = await readJsonBody(request).catch(() => null);
    if (parsed && parsed.ok) {
      const email = stringField(parsed.data.notifyEmail)?.trim() ?? "";
      if (email) {
        const emailError = getEmailValidationError(email, "Accountant email");
        if (emailError) {
          return NextResponse.json({ error: emailError }, { status: 400 });
        }
        notifyEmail = email.toLowerCase();
      }
    }

    const result = await createAccountantShareLink(notifyEmail);
    return NextResponse.json({
      ...result,
      message:
        "Accountant review link created. It stays valid for 5 days so they can review pending payments.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
