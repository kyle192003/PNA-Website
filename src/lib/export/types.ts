export type ExportFormat = "csv" | "pdf" | "xlsx";

export type SummaryRow = {
  label: string;
  value: string | number;
};

export type ExportChart = {
  title: string;
  subtitle?: string;
  kind: "bar" | "line";
  valuePrefix?: string;
  valueSuffix?: string;
  points: Array<{
    label: string;
    value: number;
  }>;
};

export type ExportReport = {
  type: "financial" | "participants" | "evaluation" | "approved-participants";
  title: string;
  eventLabel: string;
  exportedAt: string;
  highlightLabel: string;
  highlightValue: string;
  summary: SummaryRow[];
  breakdownTitle: string;
  breakdown: SummaryRow[];
  charts: ExportChart[];
  detailHeaders: string[];
  detailRows: Array<Array<string | number>>;
};

export function isExportFormat(value: string | null): value is ExportFormat {
  return value === "csv" || value === "pdf" || value === "xlsx";
}

export function slugifyFilenamePart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "all-events"
  );
}

export function buildExportFilename(
  type: ExportReport["type"],
  eventLabel: string,
  format: ExportFormat
): string {
  const date = new Date().toISOString().slice(0, 10);
  const eventSlug = slugifyFilenamePart(eventLabel);
  const ext = format === "xlsx" ? "xlsx" : format;
  return `pna-${type}-${eventSlug}-${date}.${ext}`;
}
