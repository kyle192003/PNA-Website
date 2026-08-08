import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_CERTIFICATE_TEMPLATE } from "@/lib/certificate-template";
import { DEFAULT_EVALUATION_FORM } from "@/lib/evaluation-config";

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

const JSON_RESET_TARGETS: Array<{ file: string; value: unknown }> = [
  { file: "events.json", value: [] },
  { file: "registrations.json", value: [] },
  { file: "inquiries.json", value: [] },
  { file: "certificate-template.json", value: DEFAULT_CERTIFICATE_TEMPLATE },
  {
    file: "evaluation-form.json",
    value: {
      ...DEFAULT_EVALUATION_FORM,
      updatedAt: new Date().toISOString(),
    },
  },
];

async function clearDirectoryContents(dirPath: string): Promise<number> {
  let removed = 0;
  try {
    await fs.mkdir(dirPath, { recursive: true });
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (entry.name === ".gitkeep") return;
        const fullPath = path.join(dirPath, entry.name);
        await fs.rm(fullPath, { recursive: true, force: true });
        removed += 1;
      })
    );
  } catch {
    // Directory may not exist yet.
  }
  return removed;
}

export type AdminResetResult = {
  clearedFiles: string[];
  clearedUploadFolders: number;
};

/**
 * Wipes demo/presentation data while keeping admin login credentials.
 */
export async function resetAdminDashboardData(): Promise<AdminResetResult> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const clearedFiles: string[] = [];

  for (const target of JSON_RESET_TARGETS) {
    const filePath = path.join(DATA_DIR, target.file);
    await fs.writeFile(filePath, `${JSON.stringify(target.value, null, 2)}\n`, "utf-8");
    clearedFiles.push(target.file);
  }

  const eventTemplatesDir = path.join(DATA_DIR, "certificate-templates");
  await clearDirectoryContents(eventTemplatesDir);
  clearedFiles.push("certificate-templates/");

  const uploadFolders = [
    "receipts",
    "qrcodes",
    "speakers",
    "certificates",
    "registration-qrcodes",
  ];

  let clearedUploadFolders = 0;
  for (const folder of uploadFolders) {
    clearedUploadFolders += await clearDirectoryContents(path.join(UPLOADS_ROOT, folder));
  }

  // Private receipt store (outside public/)
  clearedUploadFolders += await clearDirectoryContents(
    path.join(process.cwd(), "storage", "receipts")
  );

  return { clearedFiles, clearedUploadFolders };
}
