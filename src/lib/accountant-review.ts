import "server-only";

import { conference } from "@/lib/conference";
import { getEventById } from "@/lib/events";
import { formatParticipantName } from "@/lib/participant-name";
import { formatPeso } from "@/lib/registration-fees";
import { getAllRegistrations } from "@/lib/registrations";
import type { RegistrationRecord } from "@/lib/types/admin";
import {
  FOOD_PREFERENCE_LABELS,
  MEMBERSHIP_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/types/admin";
import type {
  AccountantDocKind,
  AccountantDocPreview,
  AccountantReviewItem,
} from "@/lib/accountant-review-types";

export type { AccountantDocKind, AccountantDocPreview, AccountantReviewItem } from "@/lib/accountant-review-types";

const DOC_LABELS: Record<AccountantDocKind, string> = {
  receipt: "Payment receipt",
  pnaId: "PNA ID",
  prcId: "PRC ID",
  bir2303: "BIR 2303",
  bir2307: "BIR 2307",
  seniorPwdId: "Senior/PWD ID",
};

function isPdfRef(url: string | null | undefined): boolean {
  return Boolean(url && /\.pdf($|\?)/i.test(url));
}

function needsAccountantReview(registration: RegistrationRecord): boolean {
  if (registration.paymentStatus === "receipt_submitted") return true;
  return registration.paymentStatus === "pending" && Boolean(registration.receiptUrl);
}

function toDoc(kind: AccountantDocKind, url: string | null | undefined): AccountantDocPreview {
  return {
    kind,
    label: DOC_LABELS[kind],
    present: Boolean(url),
    isPdf: isPdfRef(url),
  };
}

export async function toAccountantReviewItem(
  registration: RegistrationRecord
): Promise<AccountantReviewItem> {
  const event = registration.eventId ? await getEventById(registration.eventId) : null;
  const membershipTypeLabel =
    registration.membershipType && registration.membershipType in MEMBERSHIP_TYPE_LABELS
      ? MEMBERSHIP_TYPE_LABELS[registration.membershipType]
      : registration.membershipType || "—";
  const foodPreferenceLabel =
    registration.foodPreference && registration.foodPreference in FOOD_PREFERENCE_LABELS
      ? FOOD_PREFERENCE_LABELS[registration.foodPreference]
      : registration.foodPreference || "—";

  return {
    id: registration.id,
    referenceNumber: registration.referenceNumber,
    name: formatParticipantName(registration),
    email: registration.email,
    phone: registration.phone,
    dateOfBirth: registration.dateOfBirth,
    age: registration.age,
    gender: registration.gender,
    organization: registration.organization,
    institutionAddress: registration.institutionAddress,
    position: registration.position,
    membershipTypeLabel,
    pnaIdNumber: registration.pnaIdNumber,
    pnaZone: registration.pnaZone,
    pnaChapter: registration.pnaChapter,
    prcLicenseNumber: registration.prcLicenseNumber,
    prcInitialRegistrationDate: registration.prcInitialRegistrationDate,
    prcExpirationDate: registration.prcExpirationDate,
    registrationMode: registration.registrationMode,
    feeLabel: registration.feeLabel,
    specialRoleLabel:
      registration.specialRole === "committee"
        ? "Committee"
        : registration.specialRole === "speaker"
          ? "Guest Speaker"
          : null,
    seniorPwdIdNumber: registration.seniorPwdIdNumber,
    wantsSalesInvoice: registration.wantsSalesInvoice,
    bir2303InstitutionName: registration.bir2303InstitutionName,
    receiptNamedUnder: registration.receiptNamedUnder,
    foodPreferenceLabel,
    foodAllergyNote: registration.foodAllergyNote,
    paymentAmount: registration.paymentAmount,
    paymentAmountLabel: formatPeso(registration.paymentAmount ?? 0),
    paymentReference: registration.paymentReference,
    paymentStatus: registration.paymentStatus,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[registration.paymentStatus],
    receiptUploadedAt: registration.receiptUploadedAt,
    paymentNotes: registration.paymentNotes,
    eventTitle: event?.title ?? conference.conferenceName,
    createdAt: registration.createdAt,
    groupSize: registration.groupSize,
    documents: [
      toDoc("receipt", registration.receiptUrl),
      toDoc("pnaId", registration.pnaIdUrl),
      toDoc("prcId", registration.prcIdUrl),
      toDoc("bir2303", registration.bir2303Url),
      toDoc("bir2307", registration.bir2307Url),
      toDoc("seniorPwdId", registration.seniorPwdIdUrl),
    ],
  };
}

export async function listAccountantReviewQueue(): Promise<AccountantReviewItem[]> {
  const registrations = await getAllRegistrations();
  const pending = registrations.filter(needsAccountantReview);
  pending.sort((a, b) => {
    const aTime = Date.parse(a.receiptUploadedAt || a.updatedAt || a.createdAt);
    const bTime = Date.parse(b.receiptUploadedAt || b.updatedAt || b.createdAt);
    return bTime - aTime;
  });
  return Promise.all(pending.map(toAccountantReviewItem));
}
