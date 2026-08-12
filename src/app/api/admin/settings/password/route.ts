import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createSessionToken,
  getAdminSessionCookieOptions,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { updateAdminPassword } from "@/lib/admin-credentials";
import { validateAdminPassword } from "@/lib/admin-password";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readJsonBody } from "@/lib/security/safe-input";

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const currentPassword =
      typeof parsed.data.currentPassword === "string" ? parsed.data.currentPassword.trim() : "";
    const newPassword =
      typeof parsed.data.newPassword === "string" ? parsed.data.newPassword : "";
    const confirmPassword =
      typeof parsed.data.confirmPassword === "string" ? parsed.data.confirmPassword : "";

    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    }

    if (!(await verifyAdminPassword(currentPassword))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const validationError = validateAdminPassword(newPassword);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirmation do not match." },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "Choose a new password that is different from your current password." },
        { status: 400 }
      );
    }

    await updateAdminPassword(newPassword);

    const response = NextResponse.json({ message: "Password updated." });
    response.cookies.set(
      ADMIN_COOKIE,
      createSessionToken(),
      getAdminSessionCookieOptions(request)
    );

    return response;
  } catch {
    return NextResponse.json({ error: "Failed to update password." }, { status: 500 });
  }
}
