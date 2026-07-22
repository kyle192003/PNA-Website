"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const CheckInCameraScanner = dynamic(
  () =>
    import("@/components/admin/CheckInCameraScanner").then((mod) => mod.CheckInCameraScanner),
  {
    ssr: false,
    loading: () => (
      <div className="admin-card admin-check-in-camera">
        <p className="admin-muted mb-0">Loading camera scanner…</p>
      </div>
    ),
  }
);

type CheckInResponse = {
  result:
    | "checked_in"
    | "already_checked_in"
    | "too_early"
    | "not_eligible"
    | "invalid";
  message: string;
  participantName?: string;
  eventTitle?: string;
  eventDateLabel?: string;
  checkedInAt?: string | null;
};

function CheckInScannerInner() {
  const searchParams = useSearchParams();
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<CheckInResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successPopup, setSuccessPopup] = useState<CheckInResponse | null>(null);

  const submitToken = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) {
      setError("Scan or paste a check-in QR / token.");
      return;
    }

    setLoading(true);
    setError(null);
    setOutcome(null);

    try {
      const res = await fetch("/api/admin/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: value, scannedBy: "front-desk" }),
      });

      const raw = await res.text();
      let data: CheckInResponse | null = null;
      let errorMessage: string | null = null;
      try {
        const parsed = JSON.parse(raw) as CheckInResponse & { error?: string };
        data = parsed;
        errorMessage = typeof parsed.error === "string" ? parsed.error : null;
      } catch {
        setError(
          "Check-in request was blocked or interrupted (common with free tunnels like loca.lt). Refresh the page, pass the tunnel warning if shown, then try again, or test on the same Wi‑Fi without a tunnel."
        );
        return;
      }

      if (res.status === 401) {
        setError("Admin session expired. Sign in again, then return to Check-In.");
        return;
      }

      if (!data?.result) {
        setError(errorMessage ?? "Check-in failed. Please try again.");
        return;
      }

      setOutcome(data);
      if (data.result === "checked_in") {
        setSuccessPopup(data);
        setTokenInput("");
      } else {
        setTokenInput(value);
      }
    } catch {
      setError(
        "Unable to reach the check-in service. Your phone lost the tunnel connection. Keep npm run dev running on the PC and retry."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get("t") ?? searchParams.get("token");
    if (fromUrl) {
      setTokenInput(fromUrl);
      void submitToken(fromUrl);
    }
  }, [searchParams, submitToken]);

  useEffect(() => {
    if (!successPopup) return;
    const timeout = window.setTimeout(() => setSuccessPopup(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [successPopup]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void submitToken(tokenInput);
  }

  const tone =
    outcome?.result === "checked_in"
      ? "success"
      : outcome?.result === "already_checked_in"
        ? "warning"
        : outcome?.result === "too_early" || outcome?.result === "not_eligible"
          ? "info"
          : outcome
            ? "danger"
            : null;

  return (
    <div className="admin-page admin-check-in">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display">Front Desk Check-In</h1>
          <p className="admin-muted">
            Open your phone camera to scan a participant QR, or paste a token manually.
          </p>
        </div>
      </div>

      <div className="admin-card admin-check-in-camera-card">
        <CheckInCameraScanner onScan={(value) => void submitToken(value)} disabled={loading} />
      </div>

      <form className="admin-card admin-check-in-form" onSubmit={handleSubmit}>
        <label className="admin-label" htmlFor="check-in-token">
          Or paste QR payload / token
        </label>
        <input
          id="check-in-token"
          className="admin-input"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Paste token / URL, or use a keyboard wedge scanner"
          autoComplete="off"
          disabled={loading}
        />
        <p className="admin-muted mt-2 mb-0">
          Keyboard wedge scanners still work here. Scan into the field and press Enter.
        </p>
        <div className="admin-check-in-actions">
          <button type="submit" className="btn-pill-arrow" disabled={loading}>
            {loading ? "Checking in…" : "Confirm check-in"}
          </button>
          <button
            type="button"
            className="btn-pill-arrow btn-pill-arrow--outline"
            disabled={loading}
            onClick={() => {
              setTokenInput("");
              setOutcome(null);
              setError(null);
            }}
          >
            Clear
          </button>
        </div>
      </form>

      {error && (
        <div className="admin-check-in-result admin-check-in-result--danger" role="alert">
          <p className="admin-check-in-result-title">Error</p>
          <p className="mb-0">{error}</p>
        </div>
      )}

      {outcome && tone && outcome.result !== "checked_in" && (
        <div
          className={`admin-check-in-result admin-check-in-result--${tone}`}
          role="status"
          aria-live="polite"
        >
          <p className="admin-check-in-result-title">
            {outcome.result === "already_checked_in" && "Already confirmed"}
            {outcome.result === "too_early" && "Too early"}
            {outcome.result === "not_eligible" && "Not eligible"}
            {outcome.result === "invalid" && "Invalid QR"}
          </p>
          <p className="admin-check-in-result-message">{outcome.message}</p>
          {outcome.participantName && (
            <p className="admin-check-in-meta">
              <strong>Participant:</strong> {outcome.participantName}
            </p>
          )}
          {outcome.eventTitle && (
            <p className="admin-check-in-meta">
              <strong>Event:</strong> {outcome.eventTitle}
            </p>
          )}
          {outcome.eventDateLabel && (
            <p className="admin-check-in-meta">
              <strong>Event date:</strong> {outcome.eventDateLabel}
            </p>
          )}
          {outcome.checkedInAt && (
            <p className="admin-check-in-meta mb-0">
              <strong>Checked in at:</strong> {new Date(outcome.checkedInAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {successPopup?.result === "checked_in" && (
        <div className="admin-check-in-popup" role="status" aria-live="polite">
          <button
            type="button"
            className="admin-check-in-popup-close"
            aria-label="Close success popup"
            onClick={() => setSuccessPopup(null)}
          >
            ×
          </button>
          <p className="admin-check-in-popup-title">Successfully confirmed</p>
          <p className="admin-check-in-popup-message">{successPopup.message}</p>
        </div>
      )}
    </div>
  );
}

export default function AdminCheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-page">
          <p className="admin-muted">Loading check-in…</p>
        </div>
      }
    >
      <CheckInScannerInner />
    </Suspense>
  );
}
