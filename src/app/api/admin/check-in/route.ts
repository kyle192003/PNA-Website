import { NextResponse } from "next/server";
import { extractCheckInTokenFromScan } from "@/lib/check-in-qr";
import { processCheckInScan } from "@/lib/check-in";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const raw = typeof body.token === "string" ? body.token : "";
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
      typeof body.scannedBy === "string" && body.scannedBy.trim()
        ? body.scannedBy.trim()
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