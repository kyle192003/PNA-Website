const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.com.ph",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "msn.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
] as const;

const KNOWN_DOMAIN_TYPOS: Record<string, string> = {
  "gnail.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.om": "gmail.com",
  "gmail.comm": "gmail.com",
  "gmailc.om": "gmail.com",
  "gmailcom": "gmail.com",
  "gmaiil.com": "gmail.com",
  "gmaul.com": "gmail.com",
  "hotnail.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "iclod.com": "icloud.com",
  "icoud.com": "icloud.com",
  "icloud.con": "icloud.com",
};

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

export function parseEmailParts(email: string): { local: string; domain: string } | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const local = trimmed.slice(0, at).trim();
  const domain = trimmed.slice(at + 1).trim().toLowerCase();
  if (!local || !domain) return null;
  return { local, domain };
}

export function applyEmailDomain(email: string, domain: string): string {
  const parts = parseEmailParts(email);
  if (!parts) return email;
  return `${parts.local}@${domain}`;
}

export function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Closest common provider domain when the typed domain looks like a typo. */
export function getSuggestedEmailDomain(email: string): string | null {
  const parts = parseEmailParts(email);
  if (!parts) return null;
  if (!parts.domain.includes(".")) return null;

  const known = KNOWN_DOMAIN_TYPOS[parts.domain];
  if (known) return known;
  if ((COMMON_EMAIL_DOMAINS as readonly string[]).includes(parts.domain)) return null;

  let bestDomain: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const distance = levenshtein(parts.domain, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestDomain = candidate;
    }
  }

  const maxDistance = parts.domain.length >= 6 ? 2 : 1;
  if (!bestDomain || bestDistance === 0 || bestDistance > maxDistance) return null;
  return bestDomain;
}

export function getEmailConfirmationError(email: string, confirmation: string): string | null {
  if (getSuggestedEmailDomain(email)) return null;
  if (!confirmation.trim()) return "Please retype your email to confirm.";
  if (!emailsMatch(email, confirmation)) return "Email addresses do not match.";
  return null;
}
