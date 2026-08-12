import { NextResponse } from "next/server";
import { buildParticipantsExport } from "@/lib/export/builders";
import {
  exportResponse,
  parseExportEventId,
  parseExportFormat,
} from "@/lib/export/response";
import { requireAdminSession } from "@/lib/security/require-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const format = parseExportFormat(request);
    if (!format) {
      return NextResponse.json(
        { error: "format must be csv, pdf, or xlsx." },
        { status: 400 }
      );
    }

    const eventId = parseExportEventId(request);
    const report = await buildParticipantsExport(eventId);
    return exportResponse(report, format);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export participants data.";
    console.error("[export/participants]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
