"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useConfirmAction } from "@/hooks/use-confirm-action";

export function AdminResetPanel() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Enter your admin password.");
      return;
    }

    if (confirmation.trim().toUpperCase() !== "RESET") {
      setError('Type RESET in the confirmation field to continue.');
      return;
    }

    requestConfirm({
      title: "Reset dashboard data?",
      message:
        "This permanently deletes all events, participants, inquiries, receipts, QR codes, and certificate files. Your admin password is kept. This cannot be undone.",
      confirmLabel: "Wipe all data",
      variant: "danger",
      loadingMessage: "Clearing dashboard data...",
      successTitle: "Dashboard reset",
      successMessage: "All presentation data was cleared. You can start fresh.",
      onSuccessClose: () => {
        router.push("/admin");
        router.refresh();
      },
      action: async () => {
        try {
          const res = await fetch("/api/admin/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, confirmation }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error ?? "Failed to reset dashboard data.");
          }
          setPassword("");
          setConfirmation("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to reset dashboard data.");
          throw err;
        }
      },
    });
  }

  return (
    <div className="admin-settings-form-wrap">
      <LoadingOverlay show={loading} scope="local" variant="form" />
      <ActionConfirmDialogs hook={confirmHook} />

      <form onSubmit={handleSubmit} className="admin-settings-form" noValidate>
        <div className="admin-settings-fields">
          <div className="admin-settings-field">
            <label className="admin-label" htmlFor="reset-password">
              Admin password
            </label>
            <input
              id="reset-password"
              type="password"
              className="admin-input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="admin-settings-field">
            <label className="admin-label" htmlFor="reset-confirmation">
              Type <strong>RESET</strong> to confirm
            </label>
            <input
              id="reset-confirmation"
              type="text"
              className="admin-input"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={loading}
              placeholder="RESET"
              required
            />
          </div>
        </div>

        {error ? (
          <p className="admin-alert admin-alert--error mt-3 mb-0" role="alert">
            {error}
          </p>
        ) : null}

        <div className="admin-settings-actions">
          <button type="submit" className="admin-link-btn admin-link-btn--danger" disabled={loading}>
            {loading ? "Resetting..." : "Reset dashboard data"}
          </button>
        </div>
      </form>
    </div>
  );
}
