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

export function getFirstValidationError(
  errors: Record<string, string | undefined>
): string | null {
  const firstKey = Object.keys(errors)[0];
  return firstKey ? errors[firstKey] ?? null : null;
}
