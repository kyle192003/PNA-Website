"use client";

import { useState, type FormEvent } from "react";
import { validateAdminPassword } from "@/lib/admin-password";
import { PasswordStrengthIndicator } from "@/components/admin/PasswordStrengthIndicator";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useConfirmAction } from "@/hooks/use-confirm-action";

export function AdminChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!currentPassword.trim()) {
      setError("Enter your current password.");
      return;
    }

    const validationError = validateAdminPassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("Choose a new password that is different from your current password.");
      return;
    }

    requestConfirm({
      title: "Change admin password?",
      message: "Are you sure you want to update the admin password?",
      confirmLabel: "Change password",
      loadingMessage: "Updating password...",
      successTitle: "Password updated",
      successMessage: "Your admin password was changed successfully.",
      action: async () => {
        try {
          const res = await fetch("/api/admin/settings/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentPassword,
              newPassword,
              confirmPassword,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error ?? "Failed to update password.");
          }

          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to update password.");
          throw err;
        }
      },
    });
  }

  return (
    <div className="admin-settings-form-wrap">
      <LoadingOverlay show={loading} scope="local" variant="form" />
      <ActionConfirmDialogs hook={confirmHook} />

      <form onSubmit={handleSubmit} className="admin-form admin-settings-form">
        {error && <div className="admin-alert admin-alert--error">{error}</div>}

        <div className="admin-settings-fields">
          <div className="admin-settings-field">
            <label className="admin-label" htmlFor="admin-current-password">
              Current Password
            </label>
            <input
              id="admin-current-password"
              type="password"
              className="admin-input"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </div>

          <div className="admin-settings-field">
            <label className="admin-label" htmlFor="admin-new-password">
              New Password
            </label>
            <input
              id="admin-new-password"
              type="password"
              className="admin-input"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              disabled={loading}
              required
            />
            <PasswordStrengthIndicator password={newPassword} />
          </div>

          <div className="admin-settings-field">
            <label className="admin-label" htmlFor="admin-confirm-password">
              Confirm New Password
            </label>
            <input
              id="admin-confirm-password"
              type="password"
              className="admin-input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="admin-settings-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Please wait..." : "Update Password"}
          </button>
        </div>
      </form>
    </div>
  );
}
