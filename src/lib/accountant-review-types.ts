import type { PaymentStatus } from "@/lib/types/admin";

export type AccountantDocKind =
  | "receipt"
  | "pnaId"
  | "prcId"
  | "bir2303"
  | "bir2307"
  | "seniorPwdId";

export type AccountantDocPreview = {
  kind: AccountantDocKind;
  label: string;
  present: boolean;
  isPdf: boolean;
};

export type AccountantReviewItem = {
  id: string;
  referenceNumber: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  age: number | null;
  gender: string;
  organization: string;
  institutionAddress: string;
  position: string;
  membershipTypeLabel: string;
  pnaIdNumber: string;
  pnaZone: string;
  pnaChapter: string;
  prcLicenseNumber: string;
  prcInitialRegistrationDate: string;
  prcExpirationDate: string;
  registrationMode: string;
  feeLabel: string;
  specialRoleLabel: string | null;
  seniorPwdIdNumber: string;
  wantsSalesInvoice: boolean;
  bir2303InstitutionName: string;
  receiptNamedUnder: string;
  foodPreferenceLabel: string;
  foodAllergyNote: string;
  paymentAmount: number;
  paymentAmountLabel: string;
  paymentReference: string;
  paymentStatus: PaymentStatus;
  paymentStatusLabel: string;
  receiptUploadedAt: string | null;
  paymentNotes: string;
  eventTitle: string;
  createdAt: string;
  groupSize: number | null;
  documents: AccountantDocPreview[];
};
