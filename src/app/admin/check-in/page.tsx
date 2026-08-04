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

type FeedbackPopup = {
  tone: "success" | "warning" | "info" | "danger";
  title: string;
  message: string;
  participantName?: string;
};

function feedbackFromResult(data: CheckInResponse): FeedbackPopup {
  if (data.result === "checked_in") {
    return {
      tone: "success",
      title: "Checked in",
      message: data.message,
      participantName: data.participantName,
    };
  }
  if (data.result === "already_checked_in") {
    return {
      tone: "warning",
      title: "Already checked in",
      message: data.message,
      participantName: data.participantName,
    };
  }
  if (data.result === "too_early") {
    return {
      tone: "info",
      title: "Too early",
      message: data.message,
      participantName: data.participantName,
    };
  }
  if (data.result === "not_eligible") {
    return {
      tone: "info",
      title: "Not eligible",
      message: data.message,
      participantName: data.participantName,
    };
  }
  return {
    tone: "danger",
    title: "Invalid QR",
    message: data.message,
    participantName: data.participantName,
  };
}

function CheckInScannerInner() {
  const searchParams = useSearchParams();
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<FeedbackPopup | null>(null);

  const submitToken = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) {
      setPopup({
        tone: "danger",
        title: "Missing token",
        message: "Scan or paste a check-in QR / token.",
      });
      return;
    }

    setLoading(true);
    setPopup(null);

    try {
      const res = await fetch("/api/admin/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: value, scannedBy: "front-desk" }),
      });

      const rawBody = await res.text();
      let data: CheckInResponse | null = null;
      let errorMessage: string | null = null;
      try {
        const parsed = JSON.parse(rawBody) as CheckInResponse & { error?: string };
        data = parsed;
        errorMessage = typeof parsed.error === "string" ? parsed.error : null;
      } catch {
        setPopup({
          tone: "danger",
          title: "Check-in failed",
          message:
            "Check-in request was blocked or interrupted. Refresh the page and try again.",
        });
        return;
      }

      if (res.status === 401) {
        setPopup({
          tone: "danger",
          title: "Session expired",
          message: "Admin session expired. Sign in again, then return to Check-In.",
        });
        return;
      }

      if (!data?.result) {
        setPopup({
          tone: "danger",
          title: "Check-in failed",
          message: errorMessage ?? "Check-in failed. Please try again.",
        });
        return;
      }

      setPopup(feedbackFromResult(data));
      if (data.result === "checked_in" || data.result === "already_checked_in") {
        setTokenInput("");
      } else {
        setTokenInput(value);
      }
    } catch {
      setPopup({
        tone: "danger",
        title: "Connection error",
        message: "Unable to reach the check-in service. Check your connection and retry.",
      });
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
    if (!popup) return;
    const timeout = window.setTimeout(() => setPopup(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [popup]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void submitToken(tokenInput);
  }

  return (
    <div className="admin-page admin-check-in">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display">Front Desk Check-In</h1>
          <p className="admin-muted">
            Keep the camera open and scan each participant QR. Status appears briefly, then clears
            for the next scan.
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
              setPopup(null);
            }}
          >
            Clear
          </button>
        </div>
      </form>

      {popup ? (
        <div className="admin-check-in-popup-overlay" role="presentation">
          <div
            className={`admin-check-in-popup admin-check-in-popup--${popup.tone}`}
            role="status"
            aria-live="polite"
          >
            <p className="admin-check-in-popup-eyebrow">Auto-closes in 5s</p>
            <p className="admin-check-in-popup-title">{popup.title}</p>
            {popup.participantName ? (
              <p className="admin-check-in-popup-name">{popup.participantName}</p>
            ) : null}
            <p className="admin-check-in-popup-message">{popup.message}</p>
          </div>
        </div>
      ) : null}
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
