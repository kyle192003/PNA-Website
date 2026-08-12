import { NextResponse } from "next/server";
import { extractCheckInTokenFromScan } from "@/lib/check-in-qr";
import { processCheckInScan } from "@/lib/check-in";
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
    const raw = typeof parsed.data.token === "string" ? parsed.data.token : "";
    const token = extractCheckInTokenFromScan(raw);

    if (!token) {
      return NextResponse.json(
        {
          result: "invalid",
          message: "This QR code is invalid or was not found.",
        },
        { status: 400 }
      );
    }

    const scannedBy =
      typeof parsed.data.scannedBy === "string" && parsed.data.scannedBy.trim()
        ? parsed.data.scannedBy.trim()
        : "admin";

    const outcome = await processCheckInScan(token, scannedBy);
    const status =
      outcome.result === "invalid"
        ? 404
        : outcome.result === "checked_in"
          ? 200
          : 200;

    return NextResponse.json(outcome, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check-in failed.";
    console.error("[check-in]", message);
    return NextResponse.json(
      { result: "invalid", message: "Unable to process this QR code right now." },
      { status: 500 }
    );
  }
}