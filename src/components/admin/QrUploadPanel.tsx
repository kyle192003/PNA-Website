"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { ConferenceEvent } from "@/lib/types/admin";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useConfirmAction } from "@/hooks/use-confirm-action";

export function QrUploadPanel({
  event,
  onUpdated,
}: {
  event: ConferenceEvent;
  onUpdated: (event: ConferenceEvent) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState(event.showQrInRegistration);
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const form = e.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[name="file"]');
    if (!fileInput?.files?.[0]) {
      setError("Please select a QR image file.");
      return;
    }

    requestConfirm({
      title: event.qrCodeUrl ? "Replace QR code?" : "Upload QR code?",
      message: event.qrCodeUrl
        ? "Are you sure you want to replace the current payment QR code?"
        : "Are you sure you want to upload this payment QR code to the registration form?",
      confirmLabel: event.qrCodeUrl ? "Replace QR code" : "Upload QR code",
      loadingMessage: "Uploading QR code...",
      successTitle: event.qrCodeUrl ? "QR code replaced" : "QR code uploaded",
      successMessage: "The payment QR code was updated successfully.",
      action: async () => {
        const formData = new FormData(form);
        formData.set("showQrInRegistration", highlight ? "true" : "false");

        const res = await fetch(`/api/admin/events/${event.id}/qr`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Upload failed.");
          throw new Error(data.error ?? "Upload failed.");
        }
        onUpdated(data.event);
      },
    });
  }

  return (
    <div className="admin-card admin-form-wrap" id="payment-qr">
      <LoadingOverlay show={loading} scope="local" variant="form" />
      <ActionConfirmDialogs hook={confirmHook} />

      <h3 className="admin-card-title font-display">Payment QR Code</h3>
      <p className="admin-card-desc">
        Upload a QR code for event payments. When enabled, it appears in the registration form sidebar.
      </p>

      {event.qrCodeUrl && (
        <div className="admin-qr-preview">
          <Image
            src={event.qrCodeUrl}
            alt="Event payment QR code"
            width={180}
            height={180}
            className="admin-qr-image"
          />
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="admin-form mt-3">
        {error && <div className="admin-alert admin-alert--error">{error}</div>}

        <label className="admin-check mb-3">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(e) => setHighlight(e.target.checked)}
            disabled={loading}
          />
          Show in registration form
        </label>

        <input
          type="file"
          name="file"
          accept="image/*"
          className="admin-input mb-3"
          required
          disabled={loading}
        />

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Please wait..." : event.qrCodeUrl ? "Replace QR Code" : "Upload QR Code"}
        </button>
      </form>
    </div>
  );
}
