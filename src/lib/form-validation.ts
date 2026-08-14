import { getSuggestedEmailDomain } from "@/lib/email-domain";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Philippine mobile local form: 9XXXXXXXXX (10 digits, no leading 0). */
const PH_MOBILE_LOCAL_REGEX = /^9\d{9}$/;

const PHONE_PATTERNS = [
  /^(?:\+?63|0)?9\d{9}$/,
  /^(?:\+?63|0)?2\d{8,9}$/,
  /^(?:\+?63|0)?[3-9]\d{7,9}$/,
];

export const NAME_LIMITS = {
  lastName: 50,
  firstName: 100,
} as const;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/** True when the email contains letters and every letter is uppercase. */
export function isAllCapsEmail(email: string): boolean {
  const letters = email.trim().replace(/[^a-zA-Z]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

/**
 * Capitalize the first letter of each name segment as the user types
 * (spaces, hyphens, apostrophes). Later letters stay as typed.
 */
export function capitalizeNameInput(value: string): string {
  if (!value) return value;
  return value.replace(/(^|[\s'-]+)(\S)/g, (_match, boundary: string, char: string) => {
    return `${boundary}${char.toUpperCase()}`;
  });
}

export function isValidPhoneNumber(phone: string): boolean {
  const compact = phone.trim().replace(/[\s().-]/g, "");
  if (!compact) return false;
  return PHONE_PATTERNS.some((pattern) => pattern.test(compact));
}

/** Digits only for PH mobile local number (e.g. 9606207919). */
export function toPhMobileLocalDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0") && digits.length >= 11) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function isValidPhMobileLocal(phone: string): boolean {
  return PH_MOBILE_LOCAL_REGEX.test(toPhMobileLocalDigits(phone));
}

/** Normalize to international form: +639XXXXXXXXX */
export function toPhMobileInternational(phone: string): string | null {
  const local = toPhMobileLocalDigits(phone);
  if (!PH_MOBILE_LOCAL_REGEX.test(local)) return null;
  return `+63${local}`;
}

export function getEmailValidationError(email: string, label = "Email"): string | null {
  if (!email.trim()) return `${label} is required.`;
  if (!isValidEmail(email)) return `Please enter a valid ${label.toLowerCase()} address.`;
  if (isAllCapsEmail(email)) {
    return `Please enter your ${label.toLowerCase()} without ALL CAPS.`;
  }
  const suggestion = getSuggestedEmailDomain(email);
  if (suggestion) return `Please check the email domain. You mean @${suggestion}?`;
  return null;
}

export function getPhoneValidationError(phone: string, label = "Phone number"): string | null {
  if (!phone.trim()) return `${label} is required.`;
  if (!isValidPhoneNumber(phone)) {
    return `Enter a valid Philippine phone number (e.g. +63 9XX XXX XXXX or 09XX XXX XXXX).`;
  }
  return null;
}

/** Registration mobile: +63 prefix, local number starts with 9 (e.g. 9606207919). */
export function getRegistrationPhoneValidationError(
  phone: string,
  label = "Phone number"
): string | null {
  if (!phone.trim()) return `${label} is required.`;
  if (!isValidPhMobileLocal(phone)) {
    return `Enter a valid mobile number starting with 9 (e.g. 9606207919).`;
  }
  return null;
}

export function getNameLengthError(
  value: string,
  field: keyof typeof NAME_LIMITS,
  label: string
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required`;
  if (trimmed.length > NAME_LIMITS[field]) {
    return `${label} must be at most ${NAME_LIMITS[field]} characters.`;
  }
  return null;
}

export interface ContactInquiryFormData {
  name: string;
  email: string;
  mobile: string;
  message: string;
}

export type ContactInquiryFieldErrors = Partial<Record<keyof ContactInquiryFormData, string>>;

export function validateContactInquiry(data: ContactInquiryFormData): ContactInquiryFieldErrors {
  const errors: ContactInquiryFieldErrors = {};

  if (!data.name.trim()) {
    errors.name = "Full name is required.";
  } else if (data.name.trim().length < 2) {
    errors.name = "Please enter your full name.";
  }

  const emailError = getEmailValidationError(data.email, "E-mail");
  if (emailError) errors.email = emailError;

  const mobileError = getPhoneValidationError(data.mobile, "Mobile number");
  if (mobileError) errors.mobile = mobileError;

  if (!data.message.trim()) {
    errors.message = "Message is required.";
  }

  return errors;
}

export interface InquiryShareReplyFormData {
  name: string;
  email: string;
  message: string;
}

export type InquiryShareReplyFieldErrors = Partial<
  Record<keyof InquiryShareReplyFormData, string>
>;

export function validateInquiryShareReply(
  data: InquiryShareReplyFormData
): InquiryShareReplyFieldErrors {
  const errors: InquiryShareReplyFieldErrors = {};

  if (!data.name.trim()) {
    errors.name = "Full name is required.";
  } else if (data.name.trim().length < 2) {
    errors.name = "Please enter your full name.";
  } else if (data.name.trim().length > 100) {
    errors.name = "Name must be at most 100 characters.";
  }

  const emailError = getEmailValidationError(data.email, "E-mail");
  if (emailError) errors.email = emailError;

  if (!data.message.trim()) {
    errors.message = "Reply is required.";
  } else if (data.message.trim().length > 5000) {
    errors.message = "Reply must be 5000 characters or fewer.";
  }

  return errors;
}

export function getFirstValidationError(
  errors: Record<string, string | undefined>
): string | null {
  const firstKey = Object.keys(errors)[0];
  return firstKey ? errors[firstKey] ?? null : null;
}

/** Minimum age allowed to register for the conference. */
export const MIN_REGISTRATION_AGE = 17;

function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Latest date of birth that still meets the minimum registration age. */
export function getMaxDateOfBirthForMinAge(
  minAge: number = MIN_REGISTRATION_AGE
): string {
  const today = new Date();
  const maxDob = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  return toLocalIsoDate(maxDob);
}

export function calculateAgeFromDateOfBirth(dateOfBirth: string): number | null {
  const match = dateOfBirth.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dob = new Date(year, month - 1, day);
  if (
    Number.isNaN(dob.getTime()) ||
    dob.getFullYear() !== year ||
    dob.getMonth() !== month - 1 ||
    dob.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function getDateOfBirthAgeValidationError(
  dateOfBirth: string,
  minAge: number = MIN_REGISTRATION_AGE
): string | null {
  const value = dateOfBirth.trim();
  if (!value) return "Date of birth is required.";
  const age = calculateAgeFromDateOfBirth(value);
  if (age == null) return "Enter a valid date of birth.";
  if (value > toLocalIsoDate(new Date())) {
    return "Date of birth cannot be in the future.";
  }
  if (age < minAge) {
    return `Participants must be at least ${minAge} years old. Please enter your correct date of birth.`;
  }
  return null;
}
