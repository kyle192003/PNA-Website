export function escapeCsvCell(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(report: {
  summary: Array<{ label: string; value: string | number }>;
  breakdown: Array<{ label: string; value: string | number }>;
  detailHeaders: string[];
  detailRows: Array<Array<string | number>>;
}): string {
  const lines: string[] = [];

  lines.push("Metric,Value");
  for (const row of report.summary) {
    lines.push(`${escapeCsvCell(row.label)},${escapeCsvCell(row.value)}`);
  }
  for (const row of report.breakdown) {
    lines.push(`${escapeCsvCell(row.label)},${escapeCsvCell(row.value)}`);
  }

  lines.push("");
  lines.push(report.detailHeaders.map(escapeCsvCell).join(","));
  for (const row of report.detailRows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }

  return `\uFEFF${lines.join("\r\n")}`;
}
