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
      <div className="receipt-reupload-panel position-relative">
        <LoadingOverlay show scope="local" variant="form" />
        <p className="text-muted mb-0">Loading your registration...</p>
      </div>
    );
  }

  if (loadError || !info) {
    return (
      <div className="receipt-reupload-panel">
        <p className="text-danger mb-2">{loadError || "Registration not found."}</p>
        <p className="mb-0 text-muted">
          Contact the secretariat at{" "}
          <a href={`mailto:${conference.contact.registrationEmail}`}>
            {conference.contact.registrationEmail}
          </a>
          .
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="receipt-reupload-panel receipt-reupload-panel--success">
        <h2 className="h4 font-display mb-2">Receipt submitted</h2>
        <p className="mb-0">
          Thank you, {info.name}. Your new payment proof for{" "}
          <strong>{info.referenceNumber}</strong> is under review. We will email you once it is
          verified.
        </p>
      </div>
    );
  }

  return (
    <div className="receipt-reupload-panel position-relative">
      <LoadingOverlay show={submitting} scope="local" variant="form" />

      <p className="folio-eyebrow folio-eyebrow--caps mb-2">Payment proof</p>
      <h2 className="h3 font-display mb-3">Confirm your details and reupload</h2>
      <p className="text-muted mb-4">
        Your registration is still on file. Review the information below, then upload a clearer
        receipt image.
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
        <p className="mb-0 text-muted">
          This registration cannot accept a new receipt right now. Contact{" "}
          <a href={`mailto:${conference.contact.registrationEmail}`}>
            {conference.contact.registrationEmail}
          </a>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="receipt-reupload-form">
          <label className="form-label" htmlFor="receipt-file">
            New receipt image
          </label>
          <input
            id="receipt-file"
            type="file"
            accept="image/*,.pdf"
            className="form-control mb-3"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
          {submitError ? <p className="text-danger small">{submitError}</p> : null}
          <button type="submit" className="btn-editorial" disabled={!file || submitting}>
            {submitting ? "Uploading..." : "Submit new receipt"}
          </button>
        </form>
      )}
    </div>
  );
}
