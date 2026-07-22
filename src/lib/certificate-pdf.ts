import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { fitNameFontSize } from "@/lib/certificate-name-fit";
import type { CertificateRenderContext } from "@/lib/certificate-template";
import type { CertificateTemplate } from "@/lib/types/admin";

type TemplateInput = Omit<CertificateTemplate, "updatedAt">;

export async function generateCertificatePng(
  template: TemplateInput,
  context: CertificateRenderContext
): Promise<Buffer> {
  if (template.fileType === "pdf") {
    throw new Error("PNG preview is not available for PDF templates.");
  }

  return renderNameOntoImage(template, context);
}

export async function generateCertificatePdf(
  template: TemplateInput,
  context: CertificateRenderContext
): Promise<Buffer> {
  if (template.fileType === "pdf") {
    return renderCertificateFromPdfTemplate(template, context);
  }

  return renderCertificateFromImageTemplate(template, context);
}

async function renderCertificateFromImageTemplate(
  template: TemplateInput,
  context: CertificateRenderContext
): Promise<Buffer> {
  if (!template.imageUrl) {
    throw new Error("Upload a certificate template first.");
  }

  const imagePath = resolvePublicPath(template.imageUrl);
  const imageBuffer = await fs.readFile(imagePath);
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 1;
  const height = metadata.height ?? 1;

  const pdfDoc = await PDFDocument.create();
  const embedded =
    metadata.format === "jpeg" || metadata.format === "jpg"
      ? await pdfDoc.embedJpg(imageBuffer)
      : await pdfDoc.embedPng(
          metadata.format === "png"
            ? imageBuffer
            : await sharp(imageBuffer).png().toBuffer()
        );

  const page = pdfDoc.addPage([width, height]);
  page.drawImage(embedded, { x: 0, y: 0, width, height });
  await drawNameOnPage(pdfDoc, page, template, context, width, height);

  return Buffer.from(await pdfDoc.save());
}

async function renderCertificateFromPdfTemplate(
  template: TemplateInput,
  context: CertificateRenderContext
): Promise<Buffer> {
  if (!template.imageUrl) {
    throw new Error("Upload a certificate template first.");
  }

  const pdfPath = resolvePublicPath(template.imageUrl);
  const existingPdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const page = pdfDoc.getPages()[0];

  if (!page) {
    throw new Error("Certificate PDF template has no pages.");
  }

  const { width, height } = page.getSize();
  await drawNameOnPage(pdfDoc, page, template, context, width, height);

  return Buffer.from(await pdfDoc.save());
}

async function drawNameOnPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  template: TemplateInput,
  context: CertificateRenderContext,
  width: number,
  height: number
): Promise<void> {
  const boxWidth = (template.nameWidthPercent / 100) * width;
  const boxHeight = (template.nameHeightPercent / 100) * height;
  const centerX = (template.namePosXPercent / 100) * width;
  const centerYFromTop = (template.namePosYPercent / 100) * height;

  const font =
    template.nameFontWeight >= 700
      ? await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
      : await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const fontSize = fitNameFontSizeWithFont(
    context.name,
    boxWidth,
    boxHeight,
    font
  );
  const textWidth = font.widthOfTextAtSize(context.name, fontSize);
  const textHeight = font.heightAtSize(fontSize);
  const x = centerX - textWidth / 2;
  // PDF y origin is bottom-left; center the glyph box inside the placement area.
  const y = height - centerYFromTop - textHeight / 2;
  const color = hexToRgb(template.nameColor);

  page.drawText(context.name, {
    x: Math.max(0, Math.min(x, width - textWidth)),
    y: Math.max(0, Math.min(y, height - textHeight)),
    size: fontSize,
    font,
    color: rgb(color.r, color.g, color.b),
  });
}

/**
 * Sharp's foreignObject text does not render reliably on Windows.
 * Use a plain SVG <text> node instead for PNG previews.
 */
async function renderNameOntoImage(
  template: TemplateInput,
  context: CertificateRenderContext
): Promise<Buffer> {
  if (!template.imageUrl) {
    throw new Error("Upload a certificate template first.");
  }

  const imagePath = resolvePublicPath(template.imageUrl);
  const imageBuffer = await fs.readFile(imagePath);
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 1;
  const height = metadata.height ?? 1;

  const centerX = (template.namePosXPercent / 100) * width;
  const centerY = (template.namePosYPercent / 100) * height;
  const boxWidth = (template.nameWidthPercent / 100) * width;
  const boxHeight = (template.nameHeightPercent / 100) * height;
  const fontSize = fitNameFontSize(
    context.name,
    boxWidth,
    boxHeight,
    template.nameFontWeight
  );

  const overlaySvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${centerX}"
        y="${centerY}"
        text-anchor="middle"
        dominant-baseline="middle"
        alignment-baseline="middle"
        fill="${escapeXml(template.nameColor)}"
        font-size="${fontSize}"
        font-weight="${template.nameFontWeight}"
        font-family="Times New Roman, Georgia, Times, serif"
      >${escapeXml(context.name)}</text>
    </svg>
  `;

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

function fitNameFontSizeWithFont(
  name: string,
  boxWidthPx: number,
  boxHeightPx: number,
  font: PDFFont
): number {
  const trimmed = name.trim();
  if (!trimmed || boxWidthPx <= 0 || boxHeightPx <= 0) return 10;

  const maxByHeight = Math.floor(boxHeightPx * 0.78);
  const targetWidth = boxWidthPx * 0.92;
  let low = 10;
  let high = Math.max(10, maxByHeight);
  let best = 10;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const width = font.widthOfTextAtSize(trimmed, mid);
    if (width <= targetWidth && mid <= maxByHeight) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function resolvePublicPath(publicUrl: string): string {
  const cleanUrl = publicUrl.split("?")[0];
  const relative = cleanUrl.replace(/^\//, "");
  return path.join(process.cwd(), "public", relative);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) {
    return { r: 1, g: 1, b: 1 };
  }

  const value = Number.parseInt(normalized, 16);
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
