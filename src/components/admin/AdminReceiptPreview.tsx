"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

function isPdfUrl(url: string): boolean {
  return /\.pdf($|\?)/i.test(url);
}

export function AdminReceiptPreview({
  registrationId,
  receiptUrl,
  receiptUploadedAt,
  referenceNumber,
}: {
  registrationId: string;
  /** Legacy field — presence means a receipt exists; file is served via admin API. */
  receiptUrl: string | null;
  receiptUploadedAt?: string | null;
  referenceNumber: string;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!receiptUrl) {
    return (
      <div className="admin-receipt-preview admin-receipt-preview--empty">
        <p className="admin-receipt-preview-title">Proof of payment</p>
        <p className="admin-muted mb-0">No receipt uploaded yet.</p>
      </div>
    );
  }

  const previewUrl = `/api/admin/receipts/${encodeURIComponent(registrationId)}`;
  const pdf =
    isPdfUrl(receiptUrl) ||
    receiptUrl.includes(".pdf") ||
    receiptUrl.endsWith(".pdf");
  const uploadedLabel = receiptUploadedAt
    ? ` · uploaded ${new Date(receiptUploadedAt).toLocaleString()}`
    : "";

  return (
    <>
      <div className="admin-receipt-preview">
        <div className="admin-receipt-preview-head">
          <div>
            <p className="admin-receipt-preview-title">Proof of payment</p>
            <p className="admin-receipt-preview-meta mb-0">
              Match reference <strong>{referenceNumber}</strong>
              {uploadedLabel}
            </p>
          </div>
          <button
            type="button"
            className="admin-link-btn"
            onClick={() => setLightboxOpen(true)}
          >
            Expand
          </button>
        </div>

        {pdf ? (
          <button
            type="button"
            className="admin-receipt-preview-thumb admin-receipt-preview-thumb--pdf"
            onClick={() => setLightboxOpen(true)}
            aria-label="View uploaded PDF receipt"
          >
            <iframe
              src={previewUrl}
              title={`Payment receipt PDF for ${referenceNumber}`}
              className="admin-receipt-preview-iframe"
              tabIndex={-1}
            />
            <span className="admin-receipt-preview-overlay">Click to enlarge</span>
          </button>
        ) : (
          <button
            type="button"
            className="admin-receipt-preview-thumb"
            onClick={() => setLightboxOpen(true)}
            aria-label="View uploaded receipt full size"
          >
            {/* Native img: Next/Image can fail on dynamic authenticated paths */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`Payment receipt for ${referenceNumber}`}
              className="admin-receipt-preview-image"
            />
          </button>
        )}
      </div>

      <Modal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={`Receipt · ${referenceNumber}`}
        size="overview"
        contentClassName="p-3 sm:p-4"
      >
        <p className="admin-muted small mb-3">
          Verify that the receipt shows reference <strong>{referenceNumber}</strong> (or matching
          payment details) before marking paid.
        </p>
        <div className="admin-receipt-lightbox">
          {pdf ? (
            <iframe
              src={previewUrl}
              title={`Payment receipt PDF for ${referenceNumber}`}
              className="admin-receipt-lightbox-iframe"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`Payment receipt for ${referenceNumber}`}
              className="admin-receipt-lightbox-image"
            />
          )}
        </div>
        <div className="d-flex flex-wrap gap-2 mt-3">
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-link-btn"
          >
            Open in new tab
          </a>
          <button
            type="button"
            className="admin-link-btn"
            onClick={() => setLightboxOpen(false)}
          >
            Close
          </button>
        </div>
      </Modal>
    </>
  );
}
