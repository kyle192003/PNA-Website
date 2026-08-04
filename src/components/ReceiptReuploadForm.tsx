"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { conference } from "@/lib/conference";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

type ReceiptReuploadInfo = {
  referenceNumber: string;
  name: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  email: string;
  organization: string;
  paymentStatus: string;
  paymentStatusLabel: string;
  paymentNotes: string;
  canUpload: boolean;
};

function ReceiptUploadIcon() {
  return (
    <div className="evaluation-card-icon" aria-hidden="true">
      <span className="evaluation-card-icon-dot evaluation-card-icon-dot--a" />
      <span className="evaluation-card-icon-dot evaluation-card-icon-dot--b" />
      <span className="evaluation-card-icon-dot evaluation-card-icon-dot--c" />
      <svg viewBox="0 0 64 64" fill="none">
        <rect x="16" y="12" width="32" height="40" rx="4" stroke="currentColor" strokeWidth="2.5" />
        <path
          d="M28 30h8M24 38h16"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M32 22v10m0 0l-4-4m4 4l4-4"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function ReceiptReuploadForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") ?? "";

  const [info, setInfo] = useState<ReceiptReuploadInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        if (!token) {
          throw new Error("Missing reupload link. Open the link from your email.");
        }
        const res = await fetch(
          `/api/register/receipt-reupload?t=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Could not load your registration.");
        }
        if (!cancelled) setInfo(data as ReceiptReuploadInfo);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load your registration.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !info || !token) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      const formData = new FormData();
      formData.set("token", token);
      formData.set("file", file);
      const res = await fetch("/api/register/receipt", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }
      setSuccess(true);
      setFile(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="evaluation-page">
        <div className="evaluation-card position-relative">
          <LoadingOverlay show scope="local" variant="form" />
          <p className="evaluation-card-desc mb-0">Loading your registration...</p>
        </div>
      </div>
    );
  }

  if (loadError || !info) {
    return (
      <div className="evaluation-page">
        <div className="evaluation-card">
          <ReceiptUploadIcon />
          <h1 className="evaluation-card-title font-display">Reupload Receipt</h1>
          <p className="evaluation-form-error" role="alert">
            {loadError || "Registration not found."}
          </p>
          <p className="evaluation-card-desc mb-0">
            Contact the secretariat at{" "}
            <a href={`mailto:${conference.contact.registrationEmail}`}>
              {conference.contact.registrationEmail}
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="evaluation-page">
        <div className="evaluation-card">
          <ReceiptUploadIcon />
          <h1 className="evaluation-card-title font-display">Receipt submitted</h1>
          <p className="evaluation-card-done">
            Thank you, {info.name}. Your new payment proof for{" "}
            <strong>{info.referenceNumber}</strong> is under review. We will email you once it is
            verified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="evaluation-page">
      <div className="evaluation-card position-relative evaluation-card--receipt">
        <LoadingOverlay show={submitting} scope="local" variant="form" />
        <ReceiptUploadIcon />
        <h1 className="evaluation-card-title font-display">Reupload Payment Receipt</h1>
        <p className="evaluation-card-desc">
          Your registration is still on file. Confirm the details below, then upload a clearer
          receipt for review.
        </p>

        <dl className="receipt-reupload-identity">
          <div>
            <dt>Full name</dt>
            <dd>{info.name}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>{info.referenceNumber}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{info.email}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>{info.organization || "Not provided"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{info.paymentStatusLabel}</dd>
          </div>
        </dl>

        {info.paymentNotes ? (
          <div className="receipt-reupload-notes mb-4">
            <p className="folio-eyebrow folio-eyebrow--caps mb-1">Message from secretariat</p>
            <p className="mb-0">{info.paymentNotes}</p>
          </div>
        ) : null}

        {!info.canUpload ? (
          <p className="evaluation-card-desc mb-0">
            This registration cannot accept a new receipt right now. Contact{" "}
            <a href={`mailto:${conference.contact.registrationEmail}`}>
              {conference.contact.registrationEmail}
            </a>
            .
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="evaluation-form receipt-reupload-form" noValidate>
            <div className="evaluation-field-group">
              <label className="evaluation-label" htmlFor="receipt-file">
                New receipt image or PDF
                <span className="evaluation-required">*</span>
              </label>
              <input
                id="receipt-file"
                type="file"
                accept="image/*,.pdf"
                className="evaluation-input"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
              {file ? (
                <p className="evaluation-card-desc mt-2 mb-0 text-start">Selected: {file.name}</p>
              ) : null}
            </div>

            {submitError ? (
              <p className="evaluation-form-error" role="alert">
                {submitError}
              </p>
            ) : null}

            <div className="evaluation-form-footer">
              <button
                type="submit"
                className="btn-pill-arrow evaluation-submit"
                disabled={!file || submitting}
              >
                {submitting ? "Uploading..." : "Submit new receipt"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
