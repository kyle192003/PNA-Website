"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface MessageDialogProps {
  open: boolean;
  title: string;
  message: string;
  closeLabel?: string;
  variant?: "success" | "error" | "info";
  onClose: () => void;
}

export function MessageDialog({
  open,
  title,
  message,
  closeLabel = "OK",
  variant = "success",
  onClose,
}: MessageDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const icon = variant === "success" ? "✓" : variant === "error" ? "!" : "i";

  return createPortal(
    <div className={`pna-success-dialog pna-message-dialog--${variant}`} role="presentation">
      <button
        type="button"
        className="pna-success-dialog-backdrop"
        onClick={onClose}
        aria-label="Close message"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pna-message-title"
        aria-describedby="pna-message-message"
        className="pna-success-dialog-panel"
      >
        <div
          className={`pna-success-dialog-icon pna-message-dialog-icon--${variant}`}
          aria-hidden="true"
        >
          {icon}
        </div>
        <h3 id="pna-message-title" className="pna-success-dialog-title font-display">
          {title}
        </h3>
        <p id="pna-message-message" className="pna-success-dialog-message">
          {message}
        </p>
        <div className="pna-success-dialog-actions">
          <button type="button" className="pna-success-dialog-close" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** @deprecated Prefer MessageDialog — kept for existing imports. */
export function SuccessDialog(props: Omit<MessageDialogProps, "variant">) {
  return <MessageDialog {...props} variant="success" />;
}
