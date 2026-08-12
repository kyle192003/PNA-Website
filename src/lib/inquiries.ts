import { v4 as uuidv4 } from "uuid";
import { findByField } from "@/lib/json-query";
import { readJsonDocument, writeJsonDocument } from "@/lib/json-store";
import type {
  ContactInquiry,
  ContactInquiryInput,
  InquiryReply,
  InquiryStatus,
} from "@/lib/types/admin";

const INQUIRIES_FILENAME = "inquiries.json";

function normalizeStatus(status: unknown): InquiryStatus {
  if (status === "read" || status === "replied" || status === "new") return status;
  return "new";
}

function normalizeInquiry(raw: ContactInquiry): ContactInquiry {
  const createdAt = raw.createdAt ?? new Date().toISOString();
  const replies = Array.isArray(raw.replies)
    ? raw.replies
        .filter((reply): reply is InquiryReply => Boolean(reply?.id && reply?.body && reply?.sentAt))
        .map((reply) => ({
          id: String(reply.id),
          body: String(reply.body),
          sentAt: String(reply.sentAt),
        }))
    : [];

  return {
    ...raw,
    company: raw.company ?? "",
    status: normalizeStatus(raw.status),
    readAt: raw.readAt ?? null,
    repliedAt: raw.repliedAt ?? (replies.length > 0 ? replies[replies.length - 1].sentAt : null),
    replies,
    createdAt,
  };
}

async function readInquiries(): Promise<ContactInquiry[]> {
  const parsed = await readJsonDocument<ContactInquiry[]>(INQUIRIES_FILENAME, []);
  return parsed.map(normalizeInquiry);
}

async function writeInquiries(inquiries: ContactInquiry[]): Promise<void> {
  await writeJsonDocument(INQUIRIES_FILENAME, inquiries);
}

export async function createInquiry(input: ContactInquiryInput): Promise<ContactInquiry> {
  const inquiries = await readInquiries();
  const now = new Date().toISOString();

  const inquiry: ContactInquiry = {
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
  };

  inquiries.unshift(inquiry);
  await writeInquiries(inquiries);
  return inquiry;
}

export async function getAllInquiries(): Promise<ContactInquiry[]> {
  const inquiries = await readInquiries();
  return inquiries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getInquiryById(id: string): Promise<ContactInquiry | null> {
  const inquiries = await readInquiries();
  return findByField(inquiries, "id", id) ?? null;
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
  const updated: ContactInquiry = {
    ...current,
    status,
    readAt:
      status === "read" || status === "replied"
        ? current.readAt ?? now
        : null,
  };

  inquiries[index] = updated;
  await writeInquiries(inquiries);
  return updated;
}

export async function addInquiryReply(
  id: string,
  body: string
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
  };

  const updated: ContactInquiry = {
    ...current,
    status: "replied",
    readAt: current.readAt ?? now,
    repliedAt: now,
    replies: [...(current.replies ?? []), reply],
  };

  inquiries[index] = updated;
  await writeInquiries(inquiries);
  return updated;
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
