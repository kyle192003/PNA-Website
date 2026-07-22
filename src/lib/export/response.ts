import { NextResponse } from "next/server";
import { buildCsv } from "@/lib/export/csv";
import { buildExcelReport } from "@/lib/export/excel-report";
import { buildPdfReport } from "@/lib/export/pdf-report";
import {
  buildExportFilename,
  isExportFormat,
  type ExportFormat,
  type ExportReport,
} from "@/lib/export/types";

export function parseExportFormat(request: Request): ExportFormat | null {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  return isExportFormat(format) ? format : null;
}

export function parseExportEventId(request: Request): string | null {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  return eventId?.trim() || null;
}

export async function exportResponse(
  report: ExportReport,
  format: ExportFormat
): Promise<NextResponse> {
  const filename = buildExportFilename(report.type, report.eventLabel, format);

  if (format === "csv") {
    const body = buildCsv(report);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "pdf") {
    const body = await buildPdfReport(report);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const body = await buildExcelReport(report);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
