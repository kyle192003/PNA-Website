"use client";

import { getPasswordStrength } from "@/lib/admin-password";

function strengthBarColor(percent: number) {
  if (percent >= 100) return "#16a34a";
  if (percent >= 50) return "#f97316";
  return "#ef4444";
}

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const { percent, results } = getPasswordStrength(password);

  return (
    <div className="admin-password-strength" aria-live="polite">
      <p className="admin-password-strength-label">Password strength: {percent}%</p>
      <div className="admin-password-strength-bar" aria-hidden="true">
        <span
          className="admin-password-strength-bar-fill"
          style={{
            width: `${percent}%`,
            backgroundColor: strengthBarColor(percent),
          }}
        />
      </div>
      <ul className="admin-password-strength-rules">
        {results.map((rule) => (
          <li
            key={rule.id}
            className={`admin-password-strength-rule ${rule.met ? "is-met" : ""}`}
          >
            <span className="admin-password-strength-check" aria-hidden="true">
              ✓
            </span>
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
