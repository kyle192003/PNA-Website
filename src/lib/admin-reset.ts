import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_CERTIFICATE_TEMPLATE } from "@/lib/certificate-template";
import { DEFAULT_EVALUATION_FORM } from "@/lib/evaluation-config";
import { writeJsonDocument } from "@/lib/json-store";
import { isSupabaseConfigured } from "@/lib/security/server-env";
import {
  PRIVATE_UPLOADS_BUCKET,
  PUBLIC_UPLOADS_BUCKET,
  clearStoragePrefix,
} from "@/lib/supabase/storage";

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

const JSON_RESET_TARGETS: Array<{ file: string; value: unknown }> = [
  { file: "events.json", value: [] },
  { file: "registrations.json", value: [] },
  { file: "inquiries.json", value: [] },
  { file: "special-invites.json", value: [] },
  { file: "certificate-template.json", value: DEFAULT_CERTIFICATE_TEMPLATE },
  { file: "certificate-templates.json", value: {} },
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
  const clearedFiles: string[] = [];

  for (const target of JSON_RESET_TARGETS) {
    await writeJsonDocument(target.file, target.value);
    clearedFiles.push(target.file);
  }

  let clearedUploadFolders = 0;
  if (isSupabaseConfigured()) {
    for (const prefix of ["qrcodes", "speakers", "certificates", "registration-qrcodes"]) {
      clearedUploadFolders += await clearStoragePrefix(PUBLIC_UPLOADS_BUCKET, prefix);
    }
    for (const prefix of ["receipts", "registration-docs"]) {
      clearedUploadFolders += await clearStoragePrefix(PRIVATE_UPLOADS_BUCKET, prefix);
    }
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    clearedUploadFolders += await clearDirectoryContents(
      path.join(DATA_DIR, "certificate-templates")
    );
  } catch {
    // local data dir may be read-only on Vercel
  }

  const uploadFolders = [
    "receipts",
    "qrcodes",
    "speakers",
    "certificates",
    "registration-qrcodes",
  ];

  for (const folder of uploadFolders) {
    clearedUploadFolders += await clearDirectoryContents(path.join(UPLOADS_ROOT, folder));
  }

  clearedUploadFolders += await clearDirectoryContents(
    path.join(process.cwd(), "storage", "receipts")
  );
  clearedUploadFolders += await clearDirectoryContents(
    path.join(process.cwd(), "storage", "registration-docs")
  );

  return { clearedFiles, clearedUploadFolders };
}
