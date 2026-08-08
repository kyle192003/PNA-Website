/** Normalize emails for equality checks (lookup / receipt authorization). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailsMatch(a: string, b: string): boolean {
  const left = normalizeEmail(a);
  const right = normalizeEmail(b);
  if (!left || !right) return false;
  return left === right;
}

/** Mask for public UI — avoids returning the full address after verification. */
export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) return "***";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
