import { NextResponse } from "next/server";
import { verifyAdminPassword } from "@/lib/admin-auth";
import { resetAdminDashboardData } from "@/lib/admin-reset";
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
    const password = typeof parsed.data.password === "string" ? parsed.data.password : "";
    const confirmation =
      typeof parsed.data.confirmation === "string"
        ? parsed.data.confirmation.trim().toUpperCase()
        : "";

    if (!password) {
      return NextResponse.json({ error: "Admin password is required." }, { status: 400 });
    }

    if (confirmation !== "RESET") {
      return NextResponse.json(
        { error: "Type RESET to confirm that you want to wipe dashboard data." },
        { status: 400 }
      );
    }

    if (!(await verifyAdminPassword(password))) {
      return NextResponse.json({ error: "Admin password is incorrect." }, { status: 401 });
    }

    const result = await resetAdminDashboardData();

    return NextResponse.json({
      message:
        "Dashboard data cleared. Events, participants, inquiries, receipts, and certificates were reset.",
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset dashboard data.";
    console.error("[admin/reset]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
