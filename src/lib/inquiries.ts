import { v4 as uuidv4 } from "uuid";
import { findByField } from "@/lib/json-query";
import { readJsonDocument, writeJsonDocument } from "@/lib/json-store";
import {
  buildInquiryShareUrl,
  createInquiryShareNonce,
  createInquiryShareToken,
  INQUIRY_SHARE_TTL_MS,
} from "@/lib/inquiry-share-token";
import type {
  ContactInquiry,
  ContactInquiryInput,
  InquiryReply,
  InquiryReplySource,
  InquiryShareLink,
  InquiryShareLinkStatus,
  InquiryStatus,
} from "@/lib/types/admin";

const INQUIRIES_FILENAME = "inquiries.json";

type StoredShareLink = InquiryShareLink & {
  nonce: string;
};

type StoredInquiry = Omit<ContactInquiry, "shareLink"> & {
  shareLink?: StoredShareLink | null;
};

export type PublicInquiryShareView = {
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

export type ShareLinkState =
  | { ok: true; inquiry: StoredInquiry; shareLink: StoredShareLink }
  | { ok: false; error: string; status: 400 | 404 | 410 };

function normalizeStatus(status: unknown): InquiryStatus {
  if (status === "read" || status === "replied" || status === "new") return status;
  return "new";
}

function normalizeShareLink(raw: unknown): StoredShareLink | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<StoredShareLink>;
  if (!value.nonce || !value.createdAt || !value.expiresAt) return null;
  return {
    nonce: String(value.nonce),
    createdAt: String(value.createdAt),
    expiresAt: String(value.expiresAt),
    usedAt: value.usedAt ? String(value.usedAt) : null,
    usedByEmail: value.usedByEmail ? String(value.usedByEmail).toLowerCase() : undefined,
  };
}

function normalizeReply(reply: InquiryReply): InquiryReply | null {
  if (!reply?.id || !reply?.body || !reply?.sentAt) return null;
  const source: InquiryReplySource | undefined =
    reply.source === "share" || reply.source === "admin" ? reply.source : undefined;
  return {
    id: String(reply.id),
    body: String(reply.body),
    sentAt: String(reply.sentAt),
    fromName: reply.fromName ? String(reply.fromName) : undefined,
    fromEmail: reply.fromEmail ? String(reply.fromEmail).toLowerCase() : undefined,
    source,
  };
}

function normalizeInquiry(raw: ContactInquiry): StoredInquiry {
  const createdAt = raw.createdAt ?? new Date().toISOString();
  const replies = Array.isArray(raw.replies)
    ? raw.replies.map(normalizeReply).filter((reply): reply is InquiryReply => Boolean(reply))
    : [];

  return {
    ...raw,
    company: raw.company ?? "",
    status: normalizeStatus(raw.status),
    readAt: raw.readAt ?? null,
    repliedAt: raw.repliedAt ?? (replies.length > 0 ? replies[replies.length - 1].sentAt : null),
    replies,
    createdAt,
    shareLink: normalizeShareLink(raw.shareLink),
  };
}

function publicShareLink(shareLink: StoredShareLink | null | undefined): InquiryShareLink | null {
  if (!shareLink) return null;
  return {
    createdAt: shareLink.createdAt,
    expiresAt: shareLink.expiresAt,
    usedAt: shareLink.usedAt,
    usedByEmail: shareLink.usedByEmail,
  };
}

export function toAdminInquiry(inquiry: StoredInquiry | ContactInquiry): ContactInquiry {
  const stored = inquiry as StoredInquiry;
  return {
    ...stored,
    shareLink: publicShareLink(stored.shareLink),
  };
}

export function getShareLinkStatus(
  shareLink: InquiryShareLink | StoredShareLink | null | undefined
): InquiryShareLinkStatus | null {
  if (!shareLink) return null;
  if (shareLink.usedAt) return "used";
  if (Date.parse(shareLink.expiresAt) <= Date.now()) return "expired";
  return "active";
}

function buildShareUrl(inquiryId: string, shareLink: StoredShareLink): string {
  const token = createInquiryShareToken(
    inquiryId,
    shareLink.nonce,
    Date.parse(shareLink.expiresAt)
  );
  return buildInquiryShareUrl(token);
}

async function readInquiries(): Promise<StoredInquiry[]> {
  const parsed = await readJsonDocument<ContactInquiry[]>(INQUIRIES_FILENAME, []);
  return parsed.map(normalizeInquiry);
}

async function writeInquiries(inquiries: StoredInquiry[]): Promise<void> {
  await writeJsonDocument(INQUIRIES_FILENAME, inquiries);
}

export async function createInquiry(input: ContactInquiryInput): Promise<ContactInquiry> {
  const inquiries = await readInquiries();
  const now = new Date().toISOString();

  const inquiry: StoredInquiry = {
    id: uuidv4(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: "",
    mobile: input.mobile.trim(),
    message: input.message.trim(),
    status: "new",
    createdAt: now,
    readAt: null,
    repliedAt: null,
    replies: [],
    shareLink: null,
  };

  inquiries.unshift(inquiry);
  await writeInquiries(inquiries);
  return toAdminInquiry(inquiry);
}

export async function getAllInquiries(): Promise<ContactInquiry[]> {
  const inquiries = await readInquiries();
  return inquiries
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(toAdminInquiry);
}

export async function getInquiryById(id: string): Promise<ContactInquiry | null> {
  const inquiries = await readInquiries();
  const inquiry = findByField(inquiries, "id", id);
  return inquiry ? toAdminInquiry(inquiry) : null;
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus
): Promise<ContactInquiry | null> {
  const inquiries = await readInquiries();
  const index = inquiries.findIndex((inquiry) => inquiry.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const current = inquiries[index];
  const updated: StoredInquiry = {
    ...current,
    status,
    readAt:
      status === "read" || status === "replied"
        ? current.readAt ?? now
        : null,
  };

  inquiries[index] = updated;
  await writeInquiries(inquiries);
  return toAdminInquiry(updated);
}

export async function addInquiryReply(
  id: string,
  body: string,
  meta?: { fromName?: string; fromEmail?: string; source?: InquiryReplySource }
): Promise<ContactInquiry | null> {
  const inquiries = await readInquiries();
  const index = inquiries.findIndex((inquiry) => inquiry.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const current = inquiries[index];
  const reply: InquiryReply = {
    id: uuidv4(),
    body: body.trim(),
    sentAt: now,
    fromName: meta?.fromName?.trim() || undefined,
    fromEmail: meta?.fromEmail?.trim().toLowerCase() || undefined,
    source: meta?.source ?? "admin",
  };

  const updated: StoredInquiry = {
    ...current,
    status: "replied",
    readAt: current.readAt ?? now,
    repliedAt: now,
    replies: [...(current.replies ?? []), reply],
  };

  inquiries[index] = updated;
  await writeInquiries(inquiries);
  return toAdminInquiry(updated);
}

export async function createInquiryShareLink(
  id: string
): Promise<{ inquiry: ContactInquiry; url: string; expiresAt: string } | null> {
  const inquiries = await readInquiries();
  const index = inquiries.findIndex((inquiry) => inquiry.id === id);
  if (index === -1) return null;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INQUIRY_SHARE_TTL_MS).toISOString();
  const current = inquiries[index];
  const shareLink: StoredShareLink = {
    nonce: createInquiryShareNonce(),
    createdAt: now.toISOString(),
    expiresAt,
    usedAt: null,
    usedByEmail: undefined,
  };

  const updated: StoredInquiry = {
    ...current,
    shareLink,
    status: current.status === "new" ? "read" : current.status,
    readAt: current.readAt ?? now.toISOString(),
  };

  inquiries[index] = updated;
  await writeInquiries(inquiries);

  return {
    inquiry: toAdminInquiry(updated),
    url: buildShareUrl(updated.id, shareLink),
    expiresAt,
  };
}

export async function getInquiryShareLink(
  id: string
): Promise<{ inquiry: ContactInquiry; url: string | null; status: InquiryShareLinkStatus | null } | null> {
  const inquiries = await readInquiries();
  const inquiry = findByField(inquiries, "id", id);
  if (!inquiry) return null;

  const status = getShareLinkStatus(inquiry.shareLink);
  const url =
    status === "active" && inquiry.shareLink
      ? buildShareUrl(inquiry.id, inquiry.shareLink)
      : null;

  return {
    inquiry: toAdminInquiry(inquiry),
    url,
    status,
  };
}

export function resolveShareLinkState(
  inquiry: StoredInquiry | null,
  nonce: string
): ShareLinkState {
  if (!inquiry) {
    return { ok: false, error: "Inquiry not found.", status: 404 };
  }

  const shareLink = inquiry.shareLink;
  if (!shareLink || shareLink.nonce !== nonce) {
    return { ok: false, error: "This reply link is no longer valid.", status: 410 };
  }

  const status = getShareLinkStatus(shareLink);
  if (status === "used") {
    return {
      ok: false,
      error: "This reply link has already been used and is no longer available.",
      status: 410,
    };
  }
  if (status === "expired") {
    return { ok: false, error: "This reply link has expired.", status: 410 };
  }

  return { ok: true, inquiry, shareLink };
}

export async function getPublicInquiryByShareToken(
  inquiryId: string,
  nonce: string
): Promise<
  | { ok: true; inquiry: PublicInquiryShareView }
  | { ok: false; error: string; status: 400 | 404 | 410 }
> {
  const inquiries = await readInquiries();
  const inquiry = findByField(inquiries, "id", inquiryId) ?? null;
  const resolved = resolveShareLinkState(inquiry, nonce);
  if (!resolved.ok) return resolved;

  return {
    ok: true,
    inquiry: {
      name: resolved.inquiry.name,
      email: resolved.inquiry.email,
      message: resolved.inquiry.message,
      createdAt: resolved.inquiry.createdAt,
    },
  };
}

export async function consumeInquiryShareReply(input: {
  inquiryId: string;
  nonce: string;
  fromName: string;
  fromEmail: string;
  body: string;
}): Promise<
  | { ok: true; inquiry: ContactInquiry; reply: InquiryReply }
  | { ok: false; error: string; status: 400 | 404 | 410 }
> {
  const inquiries = await readInquiries();
  const index = inquiries.findIndex((inquiry) => inquiry.id === input.inquiryId);
  const current = index === -1 ? null : inquiries[index];
  const resolved = resolveShareLinkState(current, input.nonce);
  if (!resolved.ok) return resolved;

  const now = new Date().toISOString();
  const reply: InquiryReply = {
    id: uuidv4(),
    body: input.body.trim(),
    sentAt: now,
    fromName: input.fromName.trim(),
    fromEmail: input.fromEmail.trim().toLowerCase(),
    source: "share",
  };

  const updated: StoredInquiry = {
    ...resolved.inquiry,
    status: "replied",
    readAt: resolved.inquiry.readAt ?? now,
    repliedAt: now,
    replies: [...(resolved.inquiry.replies ?? []), reply],
    shareLink: {
      ...resolved.shareLink,
      usedAt: now,
      usedByEmail: reply.fromEmail,
    },
  };

  inquiries[index] = updated;
  await writeInquiries(inquiries);

  return { ok: true, inquiry: toAdminInquiry(updated), reply };
}

export async function deleteInquiry(id: string): Promise<boolean> {
  const inquiries = await readInquiries();
  const next = inquiries.filter((inquiry) => inquiry.id !== id);
  if (next.length === inquiries.length) return false;
  await writeInquiries(next);
  return true;
}

export async function countNewInquiries(): Promise<number> {
  const inquiries = await readInquiries();
  return inquiries.filter((inquiry) => inquiry.status === "new").length;
}
