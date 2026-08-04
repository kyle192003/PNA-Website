import type { RegistrationCategory } from "@/lib/conference";

export type PaymentStatus =
  | "pending"
  | "receipt_submitted"
  | "paid"
  | "receipt_issue"
  | "rejected";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending Payment",
  receipt_submitted: "Receipt Under Review",
  paid: "Paid",
  receipt_issue: "Receipt Issue",
  rejected: "Rejected",
};

export interface EventFee {
  early: number;
  regular: number;
  label: string;
}

export type EventStatus = "draft" | "upcoming" | "open" | "finished";

export interface EventSpeaker {
  id: string;
  name: string;
  title: string;
  organization: string;
  imageUrl: string | null;
}

export interface EventSpeakerInput {
  name: string;
  title: string;
  organization: string;
  imageUrl?: string | null;
}

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  upcoming: "Upcoming Soon",
  open: "Open for Registration",
  finished: "Finished",
};

export interface PublicEvent {
  id: string;
  title: string;
  theme: string;
  description: string;
  datesDisplay: string;
  venueName: string;
  venueAddress: string;
  /** Optional Google Maps link. When empty, the site builds a search link from the address. */
  venueMapsUrl: string | null;
  earlyBirdDeadline: string;
  regularDeadline: string;
  status: Extract<EventStatus, "upcoming" | "open">;
  fees: Record<RegistrationCategory, EventFee>;
  featuredOnHomepage: boolean;
  speakers: EventSpeaker[];
}

export interface ConferenceEvent {
  id: string;
  title: string;
  theme: string;
  description: string;
  datesDisplay: string;
  venueName: string;
  venueAddress: string;
  /** Optional Google Maps link. When empty, the site builds a search link from the address. */
  venueMapsUrl: string | null;
  earlyBirdDeadline: string;
  regularDeadline: string;
  fees: Record<RegistrationCategory, EventFee>;
  qrCodeUrl: string | null;
  /** Auto-generated pubmat QR linking to this event's registration form. */
  registrationQrCodeUrl: string | null;
  showQrInRegistration: boolean;
  status: EventStatus;
  featuredOnHomepage: boolean;
  /** @deprecated Use status === "open" instead. Kept for backward compatibility. */
  isActive: boolean;
  speakers: EventSpeaker[];
  createdAt: string;
  updatedAt: string;
}

export interface EventInput {
  title: string;
  theme: string;
  description: string;
  datesDisplay: string;
  venueName: string;
  venueAddress: string;
  venueMapsUrl?: string | null;
  earlyBirdDeadline: string;
  regularDeadline: string;
  fees: Record<RegistrationCategory, EventFee>;
  showQrInRegistration?: boolean;
  status?: EventStatus;
  featuredOnHomepage?: boolean;
  /** @deprecated Use status instead. */
  isActive?: boolean;
  speakers?: EventSpeaker[];
}

export type CheckInStatus = "pending" | "checked_in";

export type EvaluationQuestionType = "rating" | "text" | "textarea" | "select";

export interface EvaluationQuestion {
  id: string;
  label: string;
  type: EvaluationQuestionType;
  required: boolean;
  options?: string[];
}

export interface EvaluationFormConfig {
  title: string;
  description: string;
  questions: EvaluationQuestion[];
  updatedAt: string;
}

export interface CertificateTemplate {
  subject: string;
  fileType: "image" | "pdf";
  imageUrl: string | null;
  namePosXPercent: number;
  namePosYPercent: number;
  nameWidthPercent: number;
  nameHeightPercent: number;
  nameColor: string;
  nameFontWeight: number;
  updatedAt: string;
}

export type FeeTier = "early" | "regular";

export type RegistrationGroupRole = "primary" | "member";

export interface RegistrationRecord {
  id: string;
  referenceNumber: string;
  eventId: string | null;
  firstName: string;
  lastName: string;
  middleInitial: string;
  email: string;
  phone: string;
  organization: string;
  position: string;
  category: RegistrationCategory;
  /** Snapshot of early vs regular pricing chosen/applied at registration. */
  feeTier: FeeTier;
  /** Snapshot of the fee amount in PHP at registration time. */
  paymentAmount: number;
  address: string;
  city: string;
  province: string;
  dietaryRequirements: string;
  specialNeeds: string;
  agreeToTerms: boolean;
  paymentStatus: PaymentStatus;
  receiptUrl: string | null;
  receiptUploadedAt: string | null;
  paymentNotes: string;
  adminNotes: string;
  /** Shared id for group registrations; null for individual. */
  groupId: string | null;
  /** Primary is the payer/receipt owner; member shares org/category/address. */
  groupRole: RegistrationGroupRole | null;
  /** Headcount for the group batch; null for individual. */
  groupSize: number | null;
  /** Unguessable check-in token; assigned once at registration and never regenerated. */
  checkInToken: string;
  checkInStatus: CheckInStatus;
  checkedInAt: string | null;
  checkedInBy: string | null;
  reminder3dSentAt: string | null;
  reminder2dSentAt: string | null;
  reminder0dSentAt: string | null;
  evaluationInviteSentAt: string | null;
  evaluationSubmittedAt: string | null;
  evaluationRating: number | null;
  evaluationFeedback: string;
  evaluationAnswers: Record<string, string | number>;
  certificateSentAt: string | null;
  promotionSentEventIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GroupMemberInput {
  firstName: string;
  lastName: string;
  middleInitial?: string;
  email: string;
  phone: string;
}

export interface RegistrationInput {
  firstName: string;
  lastName: string;
  middleInitial?: string;
  email: string;
  phone: string;
  organization: string;
  position: string;
  category: RegistrationCategory;
  feeTier?: FeeTier;
  paymentAmount?: number;
  address: string;
  city: string;
  province: string;
  dietaryRequirements?: string;
  specialNeeds?: string;
  agreeToTerms: boolean;
  eventId?: string | null;
}

export interface GroupRegistrationInput {
  primary: RegistrationInput;
  members: GroupMemberInput[];
}

export type InquiryStatus = "new" | "read";

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  company: string;
  mobile: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  readAt: string | null;
}

export interface ContactInquiryInput {
  name: string;
  email: string;
  mobile: string;
  message: string;
}

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "New",
  read: "Read",
};

export interface AdminStats {
  totalParticipants: number;
  paid: number;
  pending: number;
  receiptSubmitted: number;
  receiptIssue: number;
  rejected: number;
  activeEvents: number;
  upcomingEvents: number;
}
