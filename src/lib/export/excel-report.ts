import ExcelJS from "exceljs";
import sharp from "sharp";
import { conference } from "@/lib/conference";
import { loadPnaLogo } from "@/lib/export/branding";
import type { ExportChart, ExportReport } from "@/lib/export/types";

const GREEN = "FF14532D";
const GREEN_DARK = "FF0A2F1B";
const GREEN_SOFT = "FFECFDF5";
const GREEN_PALE = "FFF7FFFA";
const TOTAL_FILL = "FFE2E8F0";
const WHITE = "FFFFFFFF";
const MUTED = "FF4B6B5C";
const INK = "FF111827";
const BORDER = "FFD1DAD4";

function escapeXml(value: string | number): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function valueLabel(chart: ExportChart, value: number): string {
  const formatted =
    Math.abs(value) >= 1000 ? value.toLocaleString("en-PH") : String(Math.round(value * 10) / 10);
  return `${chart.valuePrefix ?? ""}${formatted}${chart.valueSuffix ?? ""}`;
}

function barChartSvg(chart: ExportChart, width = 640, height = 280): string {
  const points = chart.points.filter((point) => point.value > 0).slice(0, 8);
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const chartX = 150;
  const chartY = 78;
  const chartWidth = width - 250;
  const rowHeight = 22;
  const rows = points
    .map((point, index) => {
      const y = chartY + index * rowHeight;
      const barWidth = Math.max(4, (chartWidth * point.value) / maxValue);
      const color = index === 0 ? "#14532d" : "#2f855a";
      return `
        <text x="26" y="${y + 12}" font-size="12" fill="#111827">${escapeXml(point.label)}</text>
        <rect x="${chartX}" y="${y + 2}" width="${chartWidth}" height="10" rx="5" fill="#ecfdf5"/>
        <rect x="${chartX}" y="${y + 2}" width="${barWidth}" height="10" rx="5" fill="${color}"/>
        <text x="${chartX + chartWidth + 14}" y="${y + 12}" font-size="12" font-weight="700" fill="#0a2f1b">${escapeXml(valueLabel(chart, point.value))}</text>
      `;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" rx="18" fill="#ffffff" stroke="#d1dad4"/>
    <text x="26" y="34" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#0a2f1b">${escapeXml(chart.title)}</text>
    <text x="26" y="55" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#4b6b5c">${escapeXml(chart.subtitle ?? "")}</text>
    <g font-family="Arial, Helvetica, sans-serif">${rows || `<text x="26" y="138" font-size="13" fill="#4b6b5c">No chart data available.</text>`}</g>
  </svg>`;
}

function lineChartSvg(chart: ExportChart, width = 640, height = 280): string {
  const points = chart.points.slice(-10);
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const chartX = 52;
  const chartY = 76;
  const chartWidth = width - 94;
  const chartHeight = 140;
  const coordinates = points.map((point, index) => {
    const x = chartX + (points.length === 1 ? chartWidth / 2 : (chartWidth * index) / (points.length - 1));
    const y = chartY + chartHeight - (chartHeight * point.value) / maxValue;
    return { x, y, point };
  });
  const path = coordinates
    .map((coordinate, index) => `${index === 0 ? "M" : "L"} ${coordinate.x.toFixed(1)} ${coordinate.y.toFixed(1)}`)
    .join(" ");
  const dots = coordinates
    .map(
      (coordinate, index) =>
        `<circle cx="${coordinate.x}" cy="${coordinate.y}" r="5" fill="${index === coordinates.length - 1 ? "#dba233" : "#14532d"}" stroke="#ffffff" stroke-width="2"/>`
    )
    .join("");
  const labels = coordinates
    .map((coordinate, index) => {
      if (index % Math.ceil(points.length / 5) !== 0 && index !== coordinates.length - 1) return "";
      return `<text x="${coordinate.x}" y="${height - 34}" text-anchor="middle" font-size="11" fill="#4b6b5c">${escapeXml(coordinate.point.label)}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" rx="18" fill="#ffffff" stroke="#d1dad4"/>
    <text x="26" y="34" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#0a2f1b">${escapeXml(chart.title)}</text>
    <text x="26" y="55" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#4b6b5c">${escapeXml(chart.subtitle ?? "")}</text>
    <g font-family="Arial, Helvetica, sans-serif">
      <line x1="${chartX}" y1="${chartY + chartHeight}" x2="${chartX + chartWidth}" y2="${chartY + chartHeight}" stroke="#d1dad4"/>
      <line x1="${chartX}" y1="${chartY}" x2="${chartX}" y2="${chartY + chartHeight}" stroke="#d1dad4"/>
      ${path ? `<path d="${path}" fill="none" stroke="#14532d" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}` : `<text x="26" y="138" font-size="13" fill="#4b6b5c">No chart data available.</text>`}
      ${
        coordinates.length
          ? `<text x="${coordinates[coordinates.length - 1].x - 4}" y="${Math.max(chartY + 13, coordinates[coordinates.length - 1].y - 12)}" font-size="12" font-weight="700" fill="#0a2f1b">${escapeXml(valueLabel(chart, coordinates[coordinates.length - 1].point.value))}</text>`
          : ""
      }
    </g>
  </svg>`;
}

async function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function styleMergedRange(
  worksheet: ExcelJS.Worksheet,
  range: string,
  options: Partial<ExcelJS.Style>
) {
  const [start, end] = range.split(":");
  const startCell = worksheet.getCell(start);
  const endCell = worksheet.getCell(end);
  for (let row = startCell.row; row <= endCell.row; row += 1) {
    for (let col = startCell.col; col <= endCell.col; col += 1) {
      Object.assign(worksheet.getCell(row, col), options);
    }
  }
}

function addFooter(worksheet: ExcelJS.Worksheet) {
  worksheet.headerFooter.oddFooter = `&L${conference.organization} | ${conference.contact.email}&RPage &P of &N`;
  worksheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.5,
      bottom: 0.55,
      header: 0.2,
      footer: 0.25,
    },
  };
}

export async function buildExcelReport(report: ExportReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PNA Website";
  workbook.subject = report.title;
  workbook.company = conference.organization;
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
  });
  const detail = workbook.addWorksheet("Detail", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const chartData = workbook.addWorksheet("Chart Data");

  addFooter(summary);
  addFooter(detail);
  addFooter(chartData);

  summary.columns = [
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  summary.mergeCells("A1:H5");
  styleMergedRange(summary, "A1:H5", {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_PALE } },
  });
  const logoAsset = await loadPnaLogo(256);
  if (logoAsset) {
    const logoImage = workbook.addImage({
      base64: logoAsset.png.toString("base64"),
      extension: "png",
    });
    summary.addImage(logoImage, {
      tl: { col: 0.35, row: 0.35 },
      ext: { width: 78, height: 78 },
    });
  }

  summary.getCell("B1").value = conference.organization;
  summary.getCell("B1").font = { bold: true, size: 13, color: { argb: GREEN_DARK } };
  summary.getCell("B2").value = conference.conferenceName;
  summary.getCell("B2").font = { size: 10, color: { argb: MUTED } };
  summary.getCell("B4").value = report.title;
  summary.getCell("B4").font = { bold: true, size: 22, color: { argb: GREEN } };
  summary.getCell("G1").value = report.eventLabel;
  summary.getCell("G1").font = { bold: true, size: 11, color: { argb: GREEN_DARK } };
  summary.getCell("G2").value = `Exported ${new Date(report.exportedAt).toLocaleString("en-PH")}`;
  summary.getCell("G2").font = { size: 9, color: { argb: MUTED } };

  summary.mergeCells("A7:B9");
  summary.getCell("A7").value = `${report.highlightLabel}\n${report.highlightValue}`;
  summary.getCell("A7").alignment = { vertical: "middle", wrapText: true };
  summary.getCell("A7").font = { bold: true, size: 15, color: { argb: WHITE } };
  styleMergedRange(summary, "A7:B9", {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } },
    border: {
      top: { style: "thin", color: { argb: GREEN } },
      left: { style: "thin", color: { argb: GREEN } },
      bottom: { style: "thin", color: { argb: GREEN } },
      right: { style: "thin", color: { argb: GREEN } },
    },
  });

  report.summary.slice(0, 6).forEach((row, index) => {
    const col = 3 + (index % 3) * 2;
    const rowNumber = 7 + Math.floor(index / 3) * 2;
    summary.mergeCells(rowNumber, col, rowNumber + 1, col + 1);
    const cell = summary.getCell(rowNumber, col);
    cell.value = `${row.label}\n${row.value}`;
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.font = { bold: true, size: 11, color: { argb: GREEN_DARK } };
    styleMergedRange(summary, `${cell.address}:${summary.getCell(rowNumber + 1, col + 1).address}`, {
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_SOFT } },
      border: {
        top: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      },
    });
  });

  summary.getCell("A12").value = "Visual Summary";
  summary.getCell("A12").font = { bold: true, size: 14, color: { argb: GREEN_DARK } };

  const chartPlacements = [
    { col: 0.1, row: 12.8 },
    { col: 4.1, row: 12.8 },
    { col: 0.1, row: 27.8 },
    { col: 4.1, row: 27.8 },
  ];
  for (const [index, chart] of report.charts.slice(0, 4).entries()) {
    const image = workbook.addImage({
      base64: (await svgToPng(chart.kind === "line" ? lineChartSvg(chart) : barChartSvg(chart))).toString(
        "base64"
      ),
      extension: "png",
    });
    summary.addImage(image, {
      tl: chartPlacements[index],
      ext: { width: 420, height: 184 },
    });
  }

  summary.getCell("A43").value = report.breakdownTitle;
  summary.getCell("A43").font = { bold: true, size: 13, color: { argb: GREEN_DARK } };
  summary.getCell("A44").value = "Breakdown";
  summary.getCell("B44").value = "Value";
  ["A44", "B44"].forEach((address) => {
    summary.getCell(address).font = { bold: true, color: { argb: WHITE } };
    summary.getCell(address).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: GREEN },
    };
  });
  report.breakdown.slice(0, 24).forEach((row, index) => {
    const rowIndex = 45 + index;
    summary.getCell(`A${rowIndex}`).value = row.label;
    summary.getCell(`B${rowIndex}`).value = row.value;
  });

  detail.addRow(report.detailHeaders);
  const headerRow = detail.getRow(1);
  headerRow.font = { bold: true, color: { argb: WHITE } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: GREEN },
    };
    cell.border = {
      top: { style: "thin", color: { argb: GREEN } },
      left: { style: "thin", color: { argb: GREEN } },
      bottom: { style: "thin", color: { argb: GREEN } },
      right: { style: "thin", color: { argb: GREEN } },
    };
  });

  for (const row of report.detailRows) {
    detail.addRow(row);
  }
  detail.autoFilter = {
    from: "A1",
    to: detail.getCell(1, report.detailHeaders.length).address,
  };

  report.detailHeaders.forEach((header, index) => {
    const maxCellLength = Math.max(
      String(header).length,
      ...report.detailRows.slice(0, 50).map((row) => String(row[index] ?? "").length)
    );
    detail.getColumn(index + 1).width = Math.min(34, Math.max(12, maxCellLength + 2));
  });

  chartData.addRow(["Chart", "Label", "Value"]);
  chartData.getRow(1).font = { bold: true, color: { argb: WHITE } };
  chartData.getRow(1).eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: GREEN },
    };
  });
  report.charts.forEach((chart) => {
    chart.points.forEach((point) => {
      chartData.addRow([chart.title, point.label, point.value]);
    });
  });
  chartData.getColumn(1).width = 36;
  chartData.getColumn(2).width = 28;
  chartData.getColumn(3).width = 14;

  const totalRow = 45 + Math.min(report.breakdown.length, 24);
  summary.getCell(`A${totalRow}`).value = "Totals";
  summary.getCell(`B${totalRow}`).value = report.highlightValue;
  ["A", "B"].forEach((col) => {
    const cell = summary.getCell(`${col}${totalRow}`);
    cell.font = { bold: true, color: { argb: INK } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: TOTAL_FILL },
    };
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
