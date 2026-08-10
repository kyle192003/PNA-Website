import type { EventFeeKey, RegistrationCategory } from "@/lib/conference";
import { conference } from "@/lib/conference";

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

export interface EventRateFee {
  amount: number;
  label: string;
  caption?: string;
  /** Early-bird capacity; only used for earlyBird. */
  cap?: number;
}

/** @deprecated Legacy nested early/regular fee shape. */
export interface EventFee {
  early: number;
  regular: number;
  label: string;
}

export type EventFees = Record<EventFeeKey, EventRateFee>;

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
  venueMapsUrl: string | null;
  earlyBirdDeadline: string;
  regularDeadline: string;
  status: Extract<EventStatus, "upcoming" | "open">;
  fees: EventFees;
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
  venueMapsUrl: string | null;
  earlyBirdDeadline: string;
  regularDeadline: string;
  fees: EventFees;
  qrCodeUrl: string | null;
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
  fees: EventFees;
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

/** Participant rate choice on the form. */
export type RegistrationRateChoice = "regular" | "seniorPwd";

/** Snapshot of which published fee was charged. */
export type AppliedFeeKey = EventFeeKey;

/** @deprecated Prefer appliedFeeKey / registrationRate. */
export type FeeTier = "early" | "regular";

export type MembershipType = "lifetime" | "regular" | "non_member";

export type RegistrationModeChoice = "single" | "group";

export type FoodPreference = "regular" | "vegetarian" | "no_pork" | "allergy";

export type SponsorConsent = "yes" | "no";

export type RegistrationGroupRole = "primary" | "member";

export interface RegistrationGroupMemberNote {
  lastName: string;
  firstName: string;
  middleName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  prcLicenseNumber: string;
  prcInitialRegistrationDate: string;
  prcExpirationDate: string;
  foodPreference: FoodPreference;
  foodAllergyNote: string;
  /** Each group member chooses Regular or Senior/PWD for their own fee. */
  registrationRate: RegistrationRateChoice;
  seniorPwdIdNumber: string;
}

export interface RegistrationRecord {
  id: string;
  referenceNumber: string;
  eventId: string | null;
  firstName: string;
  lastName: string;
  /** @deprecated Prefer middleName. */
  middleInitial: string;
  middleName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  age: number | null;
  gender: string;
  /** Institution / company name. */
  organization: string;
  institutionAddress: string;
  position: string;
  membershipType: MembershipType | "";
  pnaIdNumber: string;
  pnaIdUrl: string | null;
  pnaZone: string;
  pnaChapter: string;
  prcLicenseNumber: string;
  prcInitialRegistrationDate: string;
  prcExpirationDate: string;
  prcIdUrl: string | null;
  registrationMode: RegistrationModeChoice;
  registrationRate: RegistrationRateChoice | "";
  appliedFeeKey: AppliedFeeKey | "";
  feeLabel: string;
  seniorPwdIdNumber: string;
  seniorPwdIdUrl: string | null;
  groupMembersNote: RegistrationGroupMemberNote[];
  bir2303Url: string | null;
  bir2307Url: string | null;
  foodPreference: FoodPreference | "";
  foodAllergyNote: string;
  sponsorConsent: SponsorConsent | "";
  dataPrivacyConsent: boolean;
  /**
   * @deprecated Legacy fee category. New records store appliedFeeKey / feeLabel.
   * May still hold old values like "member".
   */
  category: RegistrationCategory;
  /** @deprecated Prefer appliedFeeKey. */
  feeTier: FeeTier;
  paymentAmount: number;
  /** @deprecated Personal address fields — institution address is preferred. */
  address: string;
  city: string;
  province: string;
  /** @deprecated Prefer foodPreference. */
  dietaryRequirements: string;
  specialNeeds: string;
  agreeToTerms: boolean;
  paymentStatus: PaymentStatus;
  receiptUrl: string | null;
  receiptUploadedAt: string | null;
  paymentReference: string;
  paymentNotes: string;
  adminNotes: string;
  groupId: string | null;
  groupRole: RegistrationGroupRole | null;
  groupSize: number | null;
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
  middleName?: string;
  middleInitial?: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  prcLicenseNumber?: string;
  prcInitialRegistrationDate?: string;
  prcExpirationDate?: string;
  foodPreference?: FoodPreference;
  foodAllergyNote?: string;
  registrationRate: RegistrationRateChoice;
  seniorPwdIdNumber?: string;
}

export interface RegistrationInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  middleInitial?: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  age?: number | null;
  gender: string;
  organization: string;
  institutionAddress: string;
  position: string;
  membershipType: MembershipType;
  pnaIdNumber: string;
  pnaZone: string;
  pnaChapter: string;
  prcLicenseNumber: string;
  prcInitialRegistrationDate: string;
  prcExpirationDate: string;
  registrationMode: RegistrationModeChoice;
  registrationRate: RegistrationRateChoice;
  seniorPwdIdNumber?: string;
  groupMembersNote?: RegistrationGroupMemberNote[];
  foodPreference: FoodPreference;
  foodAllergyNote?: string;
  sponsorConsent: SponsorConsent;
  dataPrivacyConsent: boolean;
  paymentReference: string;
  /** @deprecated */
  category?: RegistrationCategory;
  feeTier?: FeeTier;
  paymentAmount?: number;
  address?: string;
  city?: string;
  province?: string;
  dietaryRequirements?: string;
  specialNeeds?: string;
  agreeToTerms?: boolean;
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

export function getDefaultEventFees(): EventFees {
  const fees = conference.registration.fees;
  return {
    earlyBird: {
      amount: fees.earlyBird.amount,
      label: fees.earlyBird.label,
      caption: fees.earlyBird.caption,
      cap: fees.earlyBird.cap,
    },
    regular: {
      amount: fees.regular.amount,
      label: fees.regular.label,
      caption: fees.regular.caption,
    },
    seniorPwd: {
      amount: fees.seniorPwd.amount,
      label: fees.seniorPwd.label,
      caption: fees.seniorPwd.caption,
    },
  };
}
