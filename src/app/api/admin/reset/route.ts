import { NextResponse } from "next/server";
import { verifyAdminPassword } from "@/lib/admin-auth";
import { resetAdminDashboardData } from "@/lib/admin-reset";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = typeof body.password === "string" ? body.password : "";
    const confirmation =
      typeof body.confirmation === "string" ? body.confirmation.trim().toUpperCase() : "";

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
