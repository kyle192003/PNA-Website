import { randomBytes } from "crypto";
import { findByField } from "@/lib/json-query";
import { v4 as uuidv4 } from "uuid";
import { readJsonDocument, writeJsonDocument } from "@/lib/json-store";
import { getSiteBaseUrl } from "@/lib/site-url";
import type {
  SpecialInviteInput,
  SpecialInviteRecord,
  SpecialInviteStatus,
  SpecialRole,
} from "@/lib/types/admin";
import { buildSpecialInviteNote } from "@/lib/types/admin";

const INVITES_FILENAME = "special-invites.json";

function createInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

function normalizeRole(value: unknown): SpecialRole | null {
  return value === "committee" || value === "speaker" ? value : null;
}

function normalizeInvite(raw: SpecialInviteRecord): SpecialInviteRecord {
  const status: SpecialInviteStatus =
    raw.status === "used" || raw.status === "revoked" || raw.status === "pending"
      ? raw.status
      : "pending";

  return {
    id: raw.id,
    token: raw.token,
    email: (raw.email ?? "").trim().toLowerCase(),
    firstName: (raw.firstName ?? "").trim(),
    specialRole: normalizeRole(raw.specialRole),
    eventId: raw.eventId ?? "",
    status,
    note: raw.note?.trim() ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    sentAt: raw.sentAt ?? null,
    usedAt: raw.usedAt ?? null,
    usedByRegistrationId: raw.usedByRegistrationId ?? null,
  };
}

async function readInvites(): Promise<SpecialInviteRecord[]> {
  const parsed = await readJsonDocument<SpecialInviteRecord[]>(INVITES_FILENAME, []);
  return parsed.map(normalizeInvite);
}

async function writeInvites(invites: SpecialInviteRecord[]): Promise<void> {
  await writeJsonDocument(INVITES_FILENAME, invites);
}

export function buildSpecialInviteUrl(token: string): string {
  return `${getSiteBaseUrl()}/?invite=${encodeURIComponent(token)}`;
}

export async function getAllSpecialInvites(): Promise<SpecialInviteRecord[]> {
  const invites = await readInvites();
  return invites.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getSpecialInviteById(id: string): Promise<SpecialInviteRecord | null> {
  const invites = await readInvites();
  return findByField(invites, "id", id) ?? null;
}

export async function getSpecialInviteByToken(
  token: string
): Promise<SpecialInviteRecord | null> {
  const normalized = token.trim();
  if (!normalized) return null;
  const invites = await readInvites();
  return findByField(invites, "token", normalized) ?? null;
}

export async function createSpecialInvite(
  input: SpecialInviteInput
): Promise<SpecialInviteRecord> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const eventId = input.eventId.trim();
  const specialRole = input.specialRole;

  if (!email || !eventId) {
    throw new Error("Email and event are required.");
  }
  if (!firstName) {
    throw new Error("First name is required.");
  }
  if (specialRole !== "committee" && specialRole !== "speaker") {
    throw new Error("Please choose Committee or Guest Speaker.");
  }

  const invites = await readInvites();
  const duplicatePending = invites.some(
    (invite) =>
      invite.status === "pending" &&
      invite.email === email &&
      invite.eventId === eventId
  );
  if (duplicatePending) {
    throw new Error("A pending invite already exists for this email and event.");
  }

  const now = new Date().toISOString();
  let token = createInviteToken();
  while (invites.some((invite) => invite.token === token)) {
    token = createInviteToken();
  }

  const invite: SpecialInviteRecord = {
    id: uuidv4(),
    token,
    email,
    firstName,
    specialRole,
    eventId,
    status: "pending",
    note: buildSpecialInviteNote({
      additionalNote: input.note,
      specialRole,
    }),
    createdAt: now,
    sentAt: null,
    usedAt: null,
    usedByRegistrationId: null,
  };

  invites.unshift(invite);
  await writeInvites(invites);
  return invite;
}

export async function markSpecialInviteSent(
  id: string
): Promise<SpecialInviteRecord | null> {
  const invites = await readInvites();
  const index = invites.findIndex((invite) => invite.id === id);
  if (index === -1) return null;

  const updated: SpecialInviteRecord = {
    ...invites[index],
    sentAt: new Date().toISOString(),
  };
  invites[index] = updated;
  await writeInvites(invites);
  return updated;
}

export async function revokeSpecialInvite(id: string): Promise<SpecialInviteRecord | null> {
  const invites = await readInvites();
  const index = invites.findIndex((invite) => invite.id === id);
  if (index === -1) return null;

  const current = invites[index];
  if (current.status !== "pending") {
    throw new Error("Only pending invites can be revoked.");
  }

  const updated: SpecialInviteRecord = {
    ...current,
    status: "revoked",
  };
  invites[index] = updated;
  await writeInvites(invites);
  return updated;
}

/**
 * Atomically consume a pending invite. Returns null if the token is missing or not pending.
 */
export async function consumeSpecialInvite(
  token: string,
  registrationId: string
): Promise<SpecialInviteRecord | null> {
  const invites = await readInvites();
  const index = invites.findIndex((invite) => invite.token === token.trim());
  if (index === -1) return null;

  const current = invites[index];
  if (current.status !== "pending") return null;

  const now = new Date().toISOString();
  const updated: SpecialInviteRecord = {
    ...current,
    status: "used",
    usedAt: now,
    usedByRegistrationId: registrationId,
  };
  invites[index] = updated;
  await writeInvites(invites);
  return updated;
}
