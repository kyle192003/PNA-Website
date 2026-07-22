import { PDFDocument, PDFImage, PDFPage, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { conference } from "@/lib/conference";
import { loadPnaLogo } from "@/lib/export/branding";
import type { ExportChart, ExportReport, SummaryRow } from "@/lib/export/types";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const GREEN = rgb(0.08, 0.33, 0.18);
const GREEN_DARK = rgb(0.04, 0.19, 0.11);
const GREEN_SOFT = rgb(0.93, 0.99, 0.96);
const GREEN_PALE = rgb(0.97, 1, 0.98);
const GOLD = rgb(0.86, 0.64, 0.2);
const MUTED = rgb(0.35, 0.45, 0.4);
const INK = rgb(0.08, 0.12, 0.15);
const LINE = rgb(0.82, 0.88, 0.84);
const WHITE = rgb(1, 1, 1);
const PANEL = rgb(0.99, 1, 0.99);

type PdfFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

/** Helvetica/WinAnsi cannot encode peso, smart quotes, etc. */
function pdfText(value: string | number): string {
  return String(value ?? "")
    .replace(/\u20b1/g, "PHP ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00B7/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fitText(text: string | number, font: PDFFont, size: number, maxWidth: number): string {
  const safe = pdfText(text);
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;

  let clipped = safe;
  while (clipped.length > 0 && font.widthOfTextAtSize(`${clipped}...`, size) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return clipped ? `${clipped}...` : "...";
}

function drawText(
  page: PDFPage,
  text: string | number,
  options: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  }
) {
  const value =
    options.maxWidth === undefined
      ? pdfText(text)
      : fitText(text, options.font, options.size, options.maxWidth);

  page.drawText(value, {
    x: options.x,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.color ?? INK,
  });
}

function drawLogoMark(
  page: PDFPage,
  fonts: PdfFonts,
  logo: PDFImage | null,
  x: number,
  y: number,
  size: number
) {
  if (logo) {
    page.drawImage(logo, {
      x,
      y,
      width: size,
      height: size,
    });
    return;
  }

  const radius = size / 2;
  page.drawCircle({
    x: x + radius,
    y: y + radius,
    size: radius,
    color: GREEN,
    borderColor: GOLD,
    borderWidth: 2,
  });
  page.drawCircle({
    x: x + radius,
    y: y + radius,
    size: radius - 6,
    borderColor: WHITE,
    borderWidth: 0.8,
  });

  const letters = conference.shortName;
  const letterSize = size * 0.26;
  const letterWidth = fonts.bold.widthOfTextAtSize(letters, letterSize);
  drawText(page, letters, {
    x: x + radius - letterWidth / 2,
    y: y + radius - letterSize / 2 + 1,
    size: letterSize,
    font: fonts.bold,
    color: WHITE,
  });
}

function drawHeader(
  page: PDFPage,
  fonts: PdfFonts,
  report: ExportReport,
  logo: PDFImage | null
) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 118,
    width: PAGE_WIDTH,
    height: 118,
    color: GREEN_PALE,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 118,
    width: PAGE_WIDTH,
    height: 5,
    color: GREEN,
  });

  drawLogoMark(page, fonts, logo, MARGIN, PAGE_HEIGHT - 86, 52);
  drawText(page, conference.organization, {
    x: MARGIN + 66,
    y: PAGE_HEIGHT - 48,
    size: 12,
    font: fonts.bold,
    color: GREEN_DARK,
    maxWidth: 340,
  });
  drawText(page, conference.conferenceName, {
    x: MARGIN + 66,
    y: PAGE_HEIGHT - 64,
    size: 8.5,
    font: fonts.regular,
    color: MUTED,
    maxWidth: 340,
  });
  drawText(page, report.title, {
    x: MARGIN + 66,
    y: PAGE_HEIGHT - 90,
    size: 20,
    font: fonts.bold,
    color: GREEN,
    maxWidth: 340,
  });
  drawText(page, report.eventLabel, {
    x: PAGE_WIDTH - MARGIN - 170,
    y: PAGE_HEIGHT - 54,
    size: 10,
    font: fonts.bold,
    color: GREEN_DARK,
    maxWidth: 170,
  });
  drawText(page, `Exported ${formatDateTime(report.exportedAt)}`, {
    x: PAGE_WIDTH - MARGIN - 170,
    y: PAGE_HEIGHT - 70,
    size: 8,
    font: fonts.regular,
    color: MUTED,
    maxWidth: 170,
  });
}

function drawFooter(pdf: PDFDocument, fonts: PdfFonts) {
  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN, y: 28 },
      end: { x: PAGE_WIDTH - MARGIN, y: 28 },
      thickness: 0.6,
      color: LINE,
    });
    drawText(page, `${conference.organization} | ${conference.contact.email}`, {
      x: MARGIN,
      y: 14,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
      maxWidth: 340,
    });
    drawText(page, `Page ${index + 1} of ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 70,
      y: 14,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
      maxWidth: 70,
    });
  });
}

function drawSectionTitle(page: PDFPage, fonts: PdfFonts, title: string, x: number, y: number) {
  page.drawCircle({ x, y: y + 4, size: 3, color: GOLD });
  drawText(page, title, {
    x: x + 10,
    y,
    size: 12,
    font: fonts.bold,
    color: GREEN_DARK,
  });
}

function drawKpiCard(
  page: PDFPage,
  fonts: PdfFonts,
  row: SummaryRow,
  x: number,
  y: number,
  width: number,
  height: number,
  primary = false
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: primary ? GREEN : PANEL,
    borderColor: primary ? GREEN : LINE,
    borderWidth: 0.8,
  });
  drawText(page, String(row.label).toUpperCase(), {
    x: x + 12,
    y: y + height - 18,
    size: 7,
    font: fonts.bold,
    color: primary ? WHITE : MUTED,
    maxWidth: width - 24,
  });
  drawText(page, row.value, {
    x: x + 12,
    y: y + 14,
    size: primary ? 18 : 13,
    font: fonts.bold,
    color: primary ? WHITE : GREEN,
    maxWidth: width - 24,
  });
}

function valueLabel(chart: ExportChart, value: number): string {
  const formatted =
    Math.abs(value) >= 1000 ? value.toLocaleString("en-PH") : String(Math.round(value * 10) / 10);
  return `${chart.valuePrefix ?? ""}${formatted}${chart.valueSuffix ?? ""}`;
}

function drawBarChart(
  page: PDFPage,
  fonts: PdfFonts,
  chart: ExportChart,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const points = chart.points.filter((point) => point.value > 0).slice(0, 8);
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const chartX = x + 12;
  const chartY = y + 18;
  const chartWidth = width - 24;
  const rowHeight = Math.min(18, (height - 28) / Math.max(points.length, 1));

  if (points.length === 0) {
    drawText(page, "No chart data available.", {
      x: chartX,
      y: chartY + height / 2 - 10,
      size: 8,
      font: fonts.regular,
      color: MUTED,
    });
    return;
  }

  points.forEach((point, index) => {
    const rowY = chartY + (points.length - index - 1) * rowHeight;
    const labelWidth = 116;
    const valueWidth = 70;
    const barX = chartX + labelWidth;
    const barWidth = Math.max(2, ((chartWidth - labelWidth - valueWidth) * point.value) / maxValue);

    drawText(page, point.label, {
      x: chartX,
      y: rowY + 4,
      size: 7.5,
      font: fonts.regular,
      color: INK,
      maxWidth: labelWidth - 8,
    });
    page.drawRectangle({
      x: barX,
      y: rowY + 3,
      width: chartWidth - labelWidth - valueWidth,
      height: 8,
      color: GREEN_SOFT,
    });
    page.drawRectangle({
      x: barX,
      y: rowY + 3,
      width: barWidth,
      height: 8,
      color: index === 0 ? GREEN : rgb(0.16, 0.53, 0.32),
    });
    drawText(page, valueLabel(chart, point.value), {
      x: x + width - valueWidth,
      y: rowY + 3,
      size: 7.5,
      font: fonts.bold,
      color: GREEN_DARK,
      maxWidth: valueWidth - 8,
    });
  });
}

function drawLineChart(
  page: PDFPage,
  fonts: PdfFonts,
  chart: ExportChart,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const points = chart.points.slice(-10);
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const chartX = x + 24;
  const chartY = y + 30;
  const chartWidth = width - 48;
  const chartHeight = height - 54;

  page.drawLine({
    start: { x: chartX, y: chartY },
    end: { x: chartX + chartWidth, y: chartY },
    thickness: 0.6,
    color: LINE,
  });
  page.drawLine({
    start: { x: chartX, y: chartY },
    end: { x: chartX, y: chartY + chartHeight },
    thickness: 0.6,
    color: LINE,
  });

  if (points.length === 0) {
    drawText(page, "No chart data available.", {
      x: chartX,
      y: chartY + chartHeight / 2,
      size: 8,
      font: fonts.regular,
      color: MUTED,
    });
    return;
  }

  const coordinates = points.map((point, index) => ({
    x: chartX + (points.length === 1 ? chartWidth / 2 : (chartWidth * index) / (points.length - 1)),
    y: chartY + (chartHeight * point.value) / maxValue,
    point,
  }));

  coordinates.forEach((coordinate, index) => {
    if (index > 0) {
      const previous = coordinates[index - 1];
      page.drawLine({
        start: { x: previous.x, y: previous.y },
        end: { x: coordinate.x, y: coordinate.y },
        thickness: 1.6,
        color: GREEN,
      });
    }

    page.drawCircle({
      x: coordinate.x,
      y: coordinate.y,
      size: 2.7,
      color: index === coordinates.length - 1 ? GOLD : GREEN,
      borderColor: WHITE,
      borderWidth: 0.6,
    });

    if (index === 0 || index === coordinates.length - 1) {
      drawText(page, valueLabel(chart, coordinate.point.value), {
        x: coordinate.x - 18,
        y: coordinate.y + 7,
        size: 6.8,
        font: fonts.bold,
        color: GREEN_DARK,
        maxWidth: 48,
      });
    }
  });

  points.forEach((point, index) => {
    if (index % Math.ceil(points.length / 5) !== 0 && index !== points.length - 1) return;
    const coordinate = coordinates[index];
    drawText(page, point.label, {
      x: coordinate.x - 14,
      y: y + 13,
      size: 6.8,
      font: fonts.regular,
      color: MUTED,
      maxWidth: 34,
    });
  });
}

function drawChartPanel(
  page: PDFPage,
  fonts: PdfFonts,
  chart: ExportChart,
  x: number,
  y: number,
  width: number,
  height: number
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: PANEL,
    borderColor: LINE,
    borderWidth: 0.8,
  });
  drawText(page, chart.title, {
    x: x + 12,
    y: y + height - 18,
    size: 9,
    font: fonts.bold,
    color: GREEN_DARK,
    maxWidth: width - 24,
  });
  if (chart.subtitle) {
    drawText(page, chart.subtitle, {
      x: x + 12,
      y: y + height - 30,
      size: 6.8,
      font: fonts.regular,
      color: MUTED,
      maxWidth: width - 24,
    });
  }

  if (chart.kind === "line") {
    drawLineChart(page, fonts, chart, x, y, width, height - 34);
  } else {
    drawBarChart(page, fonts, chart, x, y, width, height - 34);
  }
}

function addPage(
  pdf: PDFDocument,
  fonts: PdfFonts,
  report: ExportReport,
  logo: PDFImage | null
): { page: PDFPage; y: number } {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeader(page, fonts, report, logo);
  return { page, y: PAGE_HEIGHT - 144 };
}

export async function buildPdfReport(report: ExportReport): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const logoAsset = await loadPnaLogo(256);
  const logo = logoAsset ? await pdf.embedPng(logoAsset.png) : null;

  let { page, y } = addPage(pdf, fonts, report, logo);

  drawKpiCard(
    page,
    fonts,
    { label: report.highlightLabel, value: report.highlightValue },
    MARGIN,
    y - 58,
    172,
    58,
    true
  );

  const summaryCards = report.summary.slice(0, 6);
  summaryCards.forEach((row, index) => {
    const cardWidth = 112;
    const cardHeight = 58;
    const x = MARGIN + 184 + (index % 3) * (cardWidth + 8);
    const cardY = y - 58 - Math.floor(index / 3) * (cardHeight + 8);
    drawKpiCard(page, fonts, row, x, cardY, cardWidth, cardHeight);
  });
  y -= 138;

  drawSectionTitle(page, fonts, "Visual Summary", MARGIN, y);
  y -= 18;

  const chartWidth = (PAGE_WIDTH - MARGIN * 2 - 12) / 2;
  const chartHeight = 134;
  report.charts.slice(0, 4).forEach((chart, index) => {
    if (index > 0 && index % 2 === 0) y -= chartHeight + 12;
    if (y - chartHeight < 70) {
      ({ page, y } = addPage(pdf, fonts, report, logo));
      drawSectionTitle(page, fonts, "Visual Summary", MARGIN, y);
      y -= 18;
    }

    const x = MARGIN + (index % 2) * (chartWidth + 12);
    drawChartPanel(page, fonts, chart, x, y - chartHeight, chartWidth, chartHeight);
  });
  y -= chartHeight + 24;

  if (y < 250) {
    ({ page, y } = addPage(pdf, fonts, report, logo));
  }

  drawSectionTitle(page, fonts, report.breakdownTitle, MARGIN, y);
  y -= 18;
  for (const row of report.breakdown.slice(0, 16)) {
    if (y < 80) ({ page, y } = addPage(pdf, fonts, report, logo));
    drawText(page, row.label, {
      x: MARGIN,
      y,
      size: 8.5,
      font: fonts.regular,
      color: INK,
      maxWidth: 360,
    });
    drawText(page, row.value, {
      x: PAGE_WIDTH - MARGIN - 110,
      y,
      size: 8.5,
      font: fonts.bold,
      color: GREEN,
      maxWidth: 110,
    });
    y -= 12;
  }

  y -= 16;
  if (y < 180) {
    ({ page, y } = addPage(pdf, fonts, report, logo));
  }

  drawSectionTitle(page, fonts, "Detailed Records", MARGIN, y);
  y -= 20;

  const usableWidth = PAGE_WIDTH - MARGIN * 2;
  const colCount = Math.min(report.detailHeaders.length, 5);
  const colWidth = usableWidth / colCount;
  const headers = report.detailHeaders.slice(0, colCount);

  const drawTableHeader = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 4,
      width: usableWidth,
      height: 18,
      color: GREEN,
    });
    headers.forEach((header, index) => {
      drawText(page, header, {
        x: MARGIN + index * colWidth + 6,
        y,
        size: 7.2,
        font: fonts.bold,
        color: WHITE,
        maxWidth: colWidth - 10,
      });
    });
    y -= 18;
  };

  drawTableHeader();
  for (const row of report.detailRows) {
    if (y < 58) {
      ({ page, y } = addPage(pdf, fonts, report, logo));
      drawTableHeader();
    }
    row.slice(0, colCount).forEach((cell, index) => {
      drawText(page, cell, {
        x: MARGIN + index * colWidth + 6,
        y,
        size: 7.2,
        font: fonts.regular,
        color: INK,
        maxWidth: colWidth - 10,
      });
    });
    y -= 14;
  }

  if (report.detailRows.length === 0) {
    drawText(page, "No detail rows for this export.", {
      x: MARGIN,
      y,
      size: 9,
      font: fonts.regular,
      color: MUTED,
    });
  }

  drawFooter(pdf, fonts);
  return Buffer.from(await pdf.save());
}
