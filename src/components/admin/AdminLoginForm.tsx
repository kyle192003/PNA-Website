"use client";

import { useState, type FormEvent } from "react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

interface AdminLoginFormProps {
  onSuccess?: () => void;
  passwordId?: string;
  redirectTo?: string;
}

export function AdminLoginForm({
  onSuccess,
  passwordId = "admin-password",
  redirectTo = "/admin",
}: AdminLoginFormProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Login failed.");
        setLoading(false);
        return;
      }

      const separator = redirectTo.includes("?") ? "&" : "?";
      const target = `${window.location.origin}${redirectTo}${separator}loggedIn=1&ts=${Date.now()}`;
      // Use hard replace navigation first for mobile Safari consistency.
      window.location.replace(target);
      // Close modal after navigation is initiated.
      onSuccess?.();
    } catch {
      setError("Login failed.");
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-modal-form-wrap">
      <LoadingOverlay show={loading} scope="local" variant="form" />
      <form onSubmit={handleSubmit} className="admin-form admin-login-modal-form">
        {error && <div className="admin-alert admin-alert--error">{error}</div>}

        <label className="admin-label" htmlFor={passwordId}>
          Password
        </label>
        <input
          id={passwordId}
          type="password"
          className="admin-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          autoFocus
          disabled={loading}
        />

        <button type="submit" className="btn-primary w-100 mt-3" disabled={loading}>
          Sign In
        </button>
      </form>
    </div>
  );
}
