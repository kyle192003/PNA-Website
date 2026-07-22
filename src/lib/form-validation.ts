const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const PHONE_PATTERNS = [
  /^(?:\+?63|0)?9\d{9}$/,
  /^(?:\+?63|0)?2\d{8,9}$/,
  /^(?:\+?63|0)?[3-9]\d{7,9}$/,
];

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isValidPhoneNumber(phone: string): boolean {
  const compact = phone.trim().replace(/[\s().-]/g, "");
  if (!compact) return false;
  return PHONE_PATTERNS.some((pattern) => pattern.test(compact));
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
