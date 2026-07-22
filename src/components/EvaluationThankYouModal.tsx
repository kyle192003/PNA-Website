"use client";

import { useEffect } from "react";

export function EvaluationThankYouModal({
  open,
  onClose,
  message,
}: {
  open: boolean;
  onClose: () => void;
  message: string;
}) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="evaluation-thanks-overlay" role="presentation">
      <button
        type="button"
        className="evaluation-thanks-backdrop"
        onClick={onClose}
        aria-label="Close thank you dialog"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="evaluation-thanks-title"
        className="evaluation-thanks"
      >
        <button
          type="button"
          className="evaluation-thanks-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="evaluation-thanks-icon" aria-hidden="true">
          <span className="evaluation-thanks-confetti evaluation-thanks-confetti--a" />
          <span className="evaluation-thanks-confetti evaluation-thanks-confetti--b" />
          <span className="evaluation-thanks-confetti evaluation-thanks-confetti--c" />
          <span className="evaluation-thanks-confetti evaluation-thanks-confetti--d" />
          <span className="evaluation-thanks-confetti evaluation-thanks-confetti--e" />
          <svg viewBox="0 0 48 48" fill="none">
            <path
              d="M12 24.5L20.5 33L36 15.5"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2 id="evaluation-thanks-title" className="evaluation-thanks-title font-display">
          Thank you!
        </h2>
        <p className="evaluation-thanks-message">{message}</p>

        <button type="button" className="btn-pill-arrow evaluation-thanks-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
