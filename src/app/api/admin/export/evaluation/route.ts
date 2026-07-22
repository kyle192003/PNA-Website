import { NextResponse } from "next/server";
import { buildEvaluationExport } from "@/lib/export/builders";
import {
  exportResponse,
  parseExportEventId,
  parseExportFormat,
} from "@/lib/export/response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const format = parseExportFormat(request);
    if (!format) {
      return NextResponse.json(
        { error: "format must be csv, pdf, or xlsx." },
        { status: 400 }
      );
    }

    const eventId = parseExportEventId(request);
    const report = await buildEvaluationExport(eventId);
    return exportResponse(report, format);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export evaluation data.";
    console.error("[export/evaluation]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
