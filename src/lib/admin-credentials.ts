import { promises as fs } from "fs";
import path from "path";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const CREDENTIALS_FILE = path.join(DATA_DIR, "admin-credentials.json");
const SCRYPT_KEYLEN = 64;

export interface AdminCredentials {
  passwordHash: string;
  passwordSalt: string;
  updatedAt: string;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function hashPassword(password: string, salt?: string) {
  const passwordSalt = salt ?? randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, passwordSalt, SCRYPT_KEYLEN).toString("hex");
  return { passwordHash, passwordSalt };
}

function verifyStoredPassword(
  password: string,
  credentials: AdminCredentials
): boolean {
  const derived = scryptSync(password, credentials.passwordSalt, SCRYPT_KEYLEN);
  const expected = Buffer.from(credentials.passwordHash, "hex");
  if (derived.length !== expected.length) return false;

  try {
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function verifyEnvPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "pna-admin-dev";
  if (password.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function getAdminCredentials(): Promise<AdminCredentials | null> {
  try {
    const content = await fs.readFile(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(content) as AdminCredentials;
  } catch {
    return null;
  }
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const stored = await getAdminCredentials();
  if (stored) {
    return verifyStoredPassword(password, stored);
  }

  return verifyEnvPassword(password);
}

export async function updateAdminPassword(password: string): Promise<AdminCredentials> {
  await ensureDataDir();
  const { passwordHash, passwordSalt } = hashPassword(password);
  const credentials: AdminCredentials = {
    passwordHash,
    passwordSalt,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), "utf-8");
  return credentials;
}
