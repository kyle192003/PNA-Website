"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { conference } from "@/lib/conference";
import { getEmailConfirmationError, getSuggestedEmailDomain, applyEmailDomain } from "@/lib/email-domain";
import {
  validateInquiryShareReply,
  type InquiryShareReplyFieldErrors,
} from "@/lib/form-validation";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

type PublicInquiry = {
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

function InquiryReplyIcon() {
  return (
    <div className="evaluation-card-icon" aria-hidden="true">
      <span className="evaluation-card-icon-dot evaluation-card-icon-dot--a" />
      <span className="evaluation-card-icon-dot evaluation-card-icon-dot--b" />
      <span className="evaluation-card-icon-dot evaluation-card-icon-dot--c" />
      <svg viewBox="0 0 64 64" fill="none">
        <rect x="14" y="16" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2.5" />
        <path
          d="M16 20l16 12 16-12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function InquiryShareReplyForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") ?? "";

  const [inquiry, setInquiry] = useState<PublicInquiry | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<InquiryShareReplyFieldErrors>({});
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
          throw new Error("Missing reply link. Open the link that was shared with you.");
        }
        const res = await fetch(`/api/inquiry-reply?t=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "This reply link is not available.");
        }
        if (!cancelled) setInquiry(data.inquiry);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "This reply link is not available.");
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

  function validateForm(): boolean {
    const nextErrors = validateInquiryShareReply({ name, email, message });
    const confirmError = getEmailConfirmationError(email, emailConfirm);
    if (confirmError && !nextErrors.email) nextErrors.email = confirmError;
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError("");
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/inquiry-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name,
          email,
          emailConfirm,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to submit your reply.");
      }
      setSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit your reply.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="evaluation-page">
        <div className="evaluation-card">
          <p className="evaluation-card-desc mb-0">Loading inquiry...</p>
        </div>
      </div>
    );
  }

  if (loadError || !inquiry) {
    return (
      <div className="evaluation-page">
        <div className="evaluation-card">
          <InquiryReplyIcon />
          <h1 className="evaluation-card-title font-display">Link unavailable</h1>
          <p className="evaluation-form-error" role="alert">
            {loadError || "This reply link is not available."}
          </p>
          <p className="evaluation-card-desc mb-0">
            Contact the secretariat at{" "}
            <a href={`mailto:${conference.contact.email}`}>{conference.contact.email}</a>.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="evaluation-page">
        <div className="evaluation-card">
          <InquiryReplyIcon />
          <h1 className="evaluation-card-title font-display">Reply submitted</h1>
          <p className="evaluation-card-done">
            Thank you, {name.trim() || "there"}. Your reply was received and this link has now
            expired. The secretariat will follow up by email.
          </p>
        </div>
      </div>
    );
  }

  const emailSuggestion = getSuggestedEmailDomain(email);

  return (
    <div className="evaluation-page">
      <div className="evaluation-card position-relative evaluation-card--inquiry-reply">
        <LoadingOverlay show={submitting} scope="local" variant="form" />
        <InquiryReplyIcon />
        <h1 className="evaluation-card-title font-display">Reply to inquiry</h1>
        <p className="evaluation-card-desc">
          This is a one-time reply link. After you submit, the link expires and the secretariat
          will continue by email.
        </p>

        <dl className="receipt-reupload-identity">
          <div>
            <dt>From</dt>
            <dd>{inquiry.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{inquiry.email}</dd>
          </div>
          <div>
            <dt>Received</dt>
            <dd>{new Date(inquiry.createdAt).toLocaleString()}</dd>
          </div>
        </dl>

        <div className="inquiry-share-original">
          <p className="folio-eyebrow folio-eyebrow--caps mb-1">Original message</p>
          <p className="mb-0">{inquiry.message}</p>
        </div>

        <form onSubmit={handleSubmit} className="evaluation-form inquiry-share-form" noValidate>
          <div className="evaluation-field-group">
            <label className="evaluation-label" htmlFor="share-reply-name">
              Your name
              <span className="evaluation-required">*</span>
            </label>
            <input
              id="share-reply-name"
              type="text"
              className={`evaluation-input${errors.name ? " evaluation-field--error" : ""}`}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
              }}
              autoComplete="name"
              required
            />
            {errors.name ? (
              <p className="evaluation-field-error" role="alert">
                {errors.name}
              </p>
            ) : null}
          </div>

          <div className="evaluation-field-group">
            <label className="evaluation-label" htmlFor="share-reply-email">
              Your e-mail
              <span className="evaluation-required">*</span>
            </label>
            <input
              id="share-reply-email"
              type="email"
              className={`evaluation-input${errors.email ? " evaluation-field--error" : ""}`}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailConfirm("");
                if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
              }}
              autoComplete="email"
              spellCheck={false}
              required
            />
            {emailSuggestion ? (
              <button
                type="button"
                className="inquiry-share-email-suggestion"
                onClick={() => {
                  setEmail(applyEmailDomain(email, emailSuggestion));
                  setEmailConfirm("");
                  setErrors((current) => ({ ...current, email: undefined }));
                }}
              >
                You mean @{emailSuggestion}?
              </button>
            ) : null}
            <label className="evaluation-label mt-3" htmlFor="share-reply-email-confirm">
              Retype e-mail to confirm
              <span className="evaluation-required">*</span>
            </label>
            <input
              id="share-reply-email-confirm"
              type="text"
              inputMode="email"
              className={`evaluation-input${errors.email ? " evaluation-field--error" : ""}`}
              value={emailConfirm}
              onChange={(event) => {
                setEmailConfirm(event.target.value);
                if (errors.email && !getEmailConfirmationError(email, event.target.value)) {
                  setErrors((current) => ({ ...current, email: undefined }));
                }
              }}
              autoComplete="off"
              spellCheck={false}
              onPaste={(event) => event.preventDefault()}
              required
            />
            {errors.email ? (
              <p className="evaluation-field-error" role="alert">
                {errors.email}
              </p>
            ) : null}
          </div>

          <div className="evaluation-field-group">
            <label className="evaluation-label" htmlFor="share-reply-message">
              Your reply
              <span className="evaluation-required">*</span>
            </label>
            <textarea
              id="share-reply-message"
              className={`evaluation-input evaluation-textarea${errors.message ? " evaluation-field--error" : ""}`}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                if (errors.message) setErrors((current) => ({ ...current, message: undefined }));
              }}
              rows={6}
              maxLength={5000}
              required
            />
            {errors.message ? (
              <p className="evaluation-field-error" role="alert">
                {errors.message}
              </p>
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
              disabled={submitting || !name.trim() || !email.trim() || !message.trim()}
            >
              {submitting ? "Submitting..." : "Submit reply"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
