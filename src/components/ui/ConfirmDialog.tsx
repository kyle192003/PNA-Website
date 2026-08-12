"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  tagline?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  tagline,
  confirmLabel = "Yes, continue",
  cancelLabel = "Cancel",
  loading = false,
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="pna-confirm-dialog" role="presentation">
      <button
        type="button"
        className="pna-confirm-dialog-backdrop"
        onClick={onCancel}
        disabled={loading}
        aria-label="Cancel confirmation"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pna-confirm-title"
        aria-describedby="pna-confirm-message"
        className="pna-confirm-dialog-panel"
      >
        <h3 id="pna-confirm-title" className="pna-confirm-dialog-title font-display">
          {title}
        </h3>
        <p id="pna-confirm-message" className="pna-confirm-dialog-message">
          {message}
        </p>
        <div className="pna-confirm-dialog-actions">
          <button
            type="button"
            className="pna-confirm-dialog-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`pna-confirm-dialog-confirm ${
              variant === "danger" ? "pna-confirm-dialog-confirm--danger" : ""
            }`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
        {tagline ? <p className="pna-confirm-dialog-tagline">{tagline}</p> : null}
      </div>
    </div>,
    document.body
  );
}
