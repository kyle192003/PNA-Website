"use client";

interface SuccessDialogProps {
  open: boolean;
  title: string;
  message: string;
  closeLabel?: string;
  onClose: () => void;
}

export function SuccessDialog({
  open,
  title,
  message,
  closeLabel = "OK",
  onClose,
}: SuccessDialogProps) {
  if (!open) return null;

  return (
    <div className="pna-success-dialog" role="presentation">
      <button
        type="button"
        className="pna-success-dialog-backdrop"
        onClick={onClose}
        aria-label="Close success message"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pna-success-title"
        aria-describedby="pna-success-message"
        className="pna-success-dialog-panel"
      >
        <div className="pna-success-dialog-icon" aria-hidden="true">
          ✓
        </div>
        <h3 id="pna-success-title" className="pna-success-dialog-title font-display">
          {title}
        </h3>
        <p id="pna-success-message" className="pna-success-dialog-message">
          {message}
        </p>
        <div className="pna-success-dialog-actions">
          <button type="button" className="pna-success-dialog-close" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
