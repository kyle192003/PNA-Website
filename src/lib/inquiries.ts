import { v4 as uuidv4 } from "uuid";
import { readJsonDocument, writeJsonDocument } from "@/lib/json-store";
import type {
  ContactInquiry,
  ContactInquiryInput,
  InquiryStatus,
} from "@/lib/types/admin";

const INQUIRIES_FILENAME = "inquiries.json";

function normalizeInquiry(raw: ContactInquiry): ContactInquiry {
  const createdAt = raw.createdAt ?? new Date().toISOString();
  return {
    ...raw,
    company: raw.company ?? "",
    status: raw.status ?? "new",
    readAt: raw.readAt ?? null,
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
  return inquiries.find((inquiry) => inquiry.id === id) ?? null;
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus
): Promise<ContactInquiry | null> {
  const inquiries = await readInquiries();
  const index = inquiries.findIndex((inquiry) => inquiry.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const updated: ContactInquiry = {
    ...inquiries[index],
    status,
    readAt: status === "read" ? now : null,
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
