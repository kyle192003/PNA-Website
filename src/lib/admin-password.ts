export type PasswordRuleId =
  | "minLength"
  | "lowercase"
  | "uppercase"
  | "numberOrSymbol";

export interface PasswordRule {
  id: PasswordRuleId;
  label: string;
  test: (password: string) => boolean;
}

export const ADMIN_PASSWORD_RULES: PasswordRule[] = [
  {
    id: "minLength",
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    id: "lowercase",
    label: "At least one small letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "uppercase",
    label: "At least one capital letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "numberOrSymbol",
    label: "At least one number or symbol",
    test: (password) => /[\d\W_]/.test(password),
  },
];

export function getPasswordRuleResults(password: string) {
  return ADMIN_PASSWORD_RULES.map((rule) => ({
    ...rule,
    met: rule.test(password),
  }));
}

export function getPasswordStrength(password: string) {
  const results = getPasswordRuleResults(password);
  const metCount = results.filter((rule) => rule.met).length;
  const percent = Math.round((metCount / ADMIN_PASSWORD_RULES.length) * 100);

  return {
    percent,
    results,
    isValid: metCount === ADMIN_PASSWORD_RULES.length,
  };
}

export function validateAdminPassword(password: string): string | null {
  const { isValid, results } = getPasswordStrength(password);
  if (isValid) return null;
  const unmet = results.find((rule) => !rule.met);
  return unmet ? `Password must meet all requirements (${unmet.label.toLowerCase()}).` : null;
}
