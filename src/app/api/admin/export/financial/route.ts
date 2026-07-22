import { NextResponse } from "next/server";
import { buildFinancialExport } from "@/lib/export/builders";
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
    const report = await buildFinancialExport(eventId);
    return exportResponse(report, format);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export financial data.";
    console.error("[export/financial]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
