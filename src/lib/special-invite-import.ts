import ExcelJS from "exceljs";
import type { SpecialInviteDraftRow, SpecialRole } from "@/lib/types/admin";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function parseSpecialRoleLabel(value: unknown): SpecialRole | "" {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  if (!raw) return "";
  if (
    raw.includes("committee") ||
    raw === "com" ||
    raw === "cmte" ||
    raw.includes("organizing")
  ) {
    return "committee";
  }
  if (
    raw.includes("speaker") ||
    raw.includes("resource speaker") ||
    raw === "spk" ||
    raw.includes("guest speaker")
  ) {
    return "speaker";
  }
  return "";
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text?: unknown }).text ?? "").trim();
  }
  if (typeof value === "object" && value !== null && "result" in value) {
    return String((value as { result?: unknown }).result ?? "").trim();
  }
  return String(value).trim();
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i += 1) {
    if (aliases.includes(headers[i])) return i;
  }
  return -1;
}

function pushDraft(
  rows: SpecialInviteDraftRow[],
  draft: SpecialInviteDraftRow,
  seenEmails: Set<string>
) {
  const email = draft.email.trim().toLowerCase();
  const firstName = draft.firstName.trim();
  if (!email && !firstName && !draft.specialRole) return;

  if (email && seenEmails.has(email)) {
    rows.push({
      ...draft,
      email,
      firstName,
      parseWarning: "Duplicate email in import file — keep only one before sending.",
    });
    return;
  }
  if (email) seenEmails.add(email);
  rows.push({
    ...draft,
    email,
    firstName,
  });
}

export async function parseSpecialInviteExcel(
  buffer: ArrayBuffer | Buffer
): Promise<SpecialInviteDraftRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    matrix.push(values.map((cell) => cellText(cell)));
  });

  return parseTabularInviteRows(matrix);
}

export function parseSpecialInviteCsv(text: string): SpecialInviteDraftRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matrix = lines.map((line) => splitCsvLine(line));
  return parseTabularInviteRows(matrix);
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function parseTabularInviteRows(matrix: string[][]): SpecialInviteDraftRow[] {
  if (matrix.length === 0) return [];

  const headerCells = matrix[0].map(normalizeHeader);
  const hasHeader =
    findColumnIndex(headerCells, ["email", "emailaddress", "e-mail"]) >= 0 ||
    findColumnIndex(headerCells, ["firstname", "first", "name", "givenname"]) >= 0;

  const headers = hasHeader ? headerCells : [];
  const dataRows = hasHeader ? matrix.slice(1) : matrix;

  const firstNameIdx = hasHeader
    ? findColumnIndex(headers, ["firstname", "first", "givenname", "name", "fullname"])
    : 0;
  const emailIdx = hasHeader
    ? findColumnIndex(headers, ["email", "emailaddress", "mail", "e-mail"])
    : 1;
  const roleIdx = hasHeader
    ? findColumnIndex(headers, ["role", "specialrole", "type", "category", "position", "designation"])
    : 2;

  const rows: SpecialInviteDraftRow[] = [];
  const seenEmails = new Set<string>();

  dataRows.forEach((cells, index) => {
    const sourceLine = (hasHeader ? index + 2 : index + 1);
    const emailFromCol = emailIdx >= 0 ? cells[emailIdx] ?? "" : "";
    const emailMatch = emailFromCol.match(EMAIL_RE) ?? cells.join(" ").match(EMAIL_RE);
    const email = (emailMatch?.[0] ?? "").toLowerCase();
    const firstName = firstNameIdx >= 0 ? cells[firstNameIdx] ?? "" : "";
    const roleRaw = roleIdx >= 0 ? cells[roleIdx] ?? "" : "";
    const specialRole = parseSpecialRoleLabel(roleRaw);

    pushDraft(
      rows,
      {
        firstName,
        email,
        specialRole,
        sourceLine,
        parseWarning: !specialRole && roleRaw
          ? `Unrecognized role “${roleRaw}”. Choose Committee or Guest Speaker.`
          : undefined,
      },
      seenEmails
    );
  });

  return rows;
}

export async function parseSpecialInvitePdf(
  buffer: ArrayBuffer | Buffer
): Promise<SpecialInviteDraftRow[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if ("GlobalWorkerOptions" in pdfjs) {
    (pdfjs as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = "";
  }
  const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    let currentLine = "";
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = "transform" in item && Array.isArray(item.transform) ? Number(item.transform[5]) : null;
      if (lastY != null && y != null && Math.abs(lastY - y) > 2 && currentLine.trim()) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
      currentLine += `${item.str} `;
      lastY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
  }

  const rows: SpecialInviteDraftRow[] = [];
  const seenEmails = new Set<string>();

  lines.forEach((line, index) => {
    const emailMatch = line.match(EMAIL_RE);
    if (!emailMatch) return;
    const email = emailMatch[0].toLowerCase();
    const withoutEmail = line.replace(emailMatch[0], " ").replace(/[|,;]+/g, " ").trim();
    const specialRole = parseSpecialRoleLabel(withoutEmail);
    const namePart = withoutEmail
      .replace(/\b(committee|speaker|guest\s*speaker|com|spk|role)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const firstName = namePart.split(/\s+/)[0] ?? "";

    pushDraft(
      rows,
      {
        firstName,
        email,
        specialRole,
        sourceLine: index + 1,
        parseWarning: !specialRole
          ? "Role not detected from PDF line — choose Committee or Guest Speaker."
          : !firstName
            ? "First name not detected from PDF line — please fill it in."
            : undefined,
      },
      seenEmails
    );
  });

  return rows;
}

export async function parseSpecialInviteFile(params: {
  fileName: string;
  mimeType?: string;
  buffer: ArrayBuffer | Buffer;
}): Promise<SpecialInviteDraftRow[]> {
  const name = params.fileName.toLowerCase();
  const mime = (params.mimeType ?? "").toLowerCase();

  if (name.endsWith(".xlsx") || name.endsWith(".xlsm") || mime.includes("spreadsheetml")) {
    return parseSpecialInviteExcel(params.buffer);
  }

  if (name.endsWith(".csv") || mime === "text/csv") {
    const text =
      typeof Buffer !== "undefined" && Buffer.isBuffer(params.buffer)
        ? params.buffer.toString("utf8")
        : new TextDecoder("utf-8").decode(params.buffer as ArrayBuffer);
    return parseSpecialInviteCsv(text);
  }

  if (name.endsWith(".pdf") || mime === "application/pdf") {
    return parseSpecialInvitePdf(params.buffer);
  }

  throw new Error("Please upload an Excel (.xlsx), CSV, or PDF file.");
}
