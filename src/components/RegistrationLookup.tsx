"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { conference } from "@/lib/conference";
import { PAYMENT_STATUS_LABELS } from "@/lib/types/admin";
import { useRegistrationLookup } from "@/hooks/use-registrations";
import { submitReceipt } from "@/lib/api/registrations";
import { queryKeys } from "@/lib/query-keys";
import { formatParticipantName } from "@/lib/participant-name";
import { PaymentStatusBadge } from "@/components/admin/PaymentStatusBadge";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { LookupResultSkeleton } from "@/components/ui/Skeleton";
import { useConfirmAction } from "@/hooks/use-confirm-action";

export function RegistrationLookup({
  variant = "default",
}: {
  variant?: "default" | "sidebar";
}) {
  const queryClient = useQueryClient();
  const isSidebar = variant === "sidebar";
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [searchReference, setSearchReference] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  const lookupQuery = useRegistrationLookup(
    searchReference,
    searchEmail,
    searchReference.length > 0 && searchEmail.length > 0
  );

  function handleLookup(e: FormEvent) {
    e.preventDefault();
    const trimmedRef = reference.trim().toUpperCase();
    const trimmedEmail = email.trim();
    if (!trimmedRef || !trimmedEmail) return;
    setSearchReference(trimmedRef);
    setSearchEmail(trimmedEmail);
    setUploadError("");
  }

  function handleReceiptUpload(e: FormEvent) {
    e.preventDefault();
    if (!receiptFile || !lookupQuery.data || !searchEmail) return;

    const registration = lookupQuery.data;
    const file = receiptFile;
    const emailForUpload = searchEmail;

    requestConfirm({
      title: "Submit receipt?",
      message: `Are you sure you want to submit this payment proof for reference ${registration.referenceNumber}?`,
      confirmLabel: "Submit receipt",
      loadingMessage: "Uploading receipt...",
      successTitle: "Receipt submitted",
      successMessage: "Our team will review your payment shortly.",
      action: async () => {
        setUploadError("");
        try {
          await submitReceipt(registration.referenceNumber, file, emailForUpload);
          setReceiptFile(null);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.registrations.lookup(
              registration.referenceNumber,
              emailForUpload
            ),
          });
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : "Upload failed.");
          throw err;
        }
      },
    });
  }

  const canUploadReceipt = Boolean(lookupQuery.data?.canUpload);
  const isBusy = lookupQuery.isFetching || loading;

  return (
    <div
      className={`registration-lookup-wrap ${isSidebar ? "registration-sidebar-block" : "glass-card p-6"}`}
    >
      <LoadingOverlay show={loading} scope="local" variant="form" />
      <ActionConfirmDialogs hook={confirmHook} />

      <h3
        className={`font-display font-bold mb-2 ${isSidebar ? "registration-sidebar-heading h6" : "text-ink"}`}
      >
        Check Registration Status
      </h3>
      <p className={`text-sm mb-4 ${isSidebar ? "registration-sidebar-muted" : "text-muted"}`}>
        Enter your reference number and the email used at registration to verify status and upload
        payment proof.
      </p>

      <form onSubmit={handleLookup} className="d-flex flex-column gap-2">
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="PNA-2026-A1B2C3D4"
          className={`uppercase ${isSidebar ? "registration-sidebar-input" : "input-dark"}`}
          disabled={isBusy}
          autoComplete="off"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email used at registration"
          className={isSidebar ? "registration-sidebar-input" : "input-dark"}
          disabled={isBusy}
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={isBusy || !reference.trim() || !email.trim()}
          className={`btn-primary ${isSidebar ? "registration-sidebar-btn" : "!py-2.5 !px-4 !text-xs"}`}
        >
          Look Up
        </button>
      </form>

      {lookupQuery.isFetching && <LookupResultSkeleton />}

      {lookupQuery.isError && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${isSidebar ? "registration-sidebar-error" : "bg-red-500/10 border border-red-500/30 text-red-300"}`}
        >
          {lookupQuery.error.message}
        </div>
      )}

      {lookupQuery.isSuccess && lookupQuery.data && (
        <div
          className={`mt-4 rounded-lg p-4 ${isSidebar ? "registration-sidebar-success" : "bg-emerald-500/10 border border-emerald-500/30"}`}
        >
          <p
            className={`text-sm font-semibold mb-2 ${isSidebar ? "text-green-100" : "text-emerald-300"}`}
          >
            Registration Found
          </p>
          <dl
            className={`space-y-1 text-sm ${isSidebar ? "registration-sidebar-muted" : "text-emerald-200/80"}`}
          >
            <div className="flex justify-between gap-4">
              <dt className={isSidebar ? "registration-sidebar-muted" : "text-emerald-400"}>
                Reference
              </dt>
              <dd
                className={`font-semibold ${isSidebar ? "registration-sidebar-text" : "text-ink"}`}
              >
                {lookupQuery.data.referenceNumber}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className={isSidebar ? "registration-sidebar-muted" : "text-emerald-400"}>Name</dt>
              <dd className={isSidebar ? "registration-sidebar-text" : undefined}>
                {formatParticipantName(lookupQuery.data)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className={isSidebar ? "registration-sidebar-muted" : "text-emerald-400"}>
                Email
              </dt>
              <dd className={`text-end ${isSidebar ? "registration-sidebar-text" : undefined}`}>
                {lookupQuery.data.emailMasked}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className={isSidebar ? "registration-sidebar-muted" : "text-emerald-400"}>
                Organization
              </dt>
              <dd className={`text-end ${isSidebar ? "registration-sidebar-text" : undefined}`}>
                {lookupQuery.data.organization}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className={isSidebar ? "registration-sidebar-muted" : "text-emerald-400"}>
                Category
              </dt>
              <dd className={isSidebar ? "registration-sidebar-text" : undefined}>
                {conference.registration.fees[lookupQuery.data.category].label}
              </dd>
            </div>
            <div className="flex justify-between gap-4 align-items-center">
              <dt className={isSidebar ? "registration-sidebar-muted" : "text-emerald-400"}>
                Payment
              </dt>
              <dd>
                <PaymentStatusBadge status={lookupQuery.data.paymentStatus} />
              </dd>
            </div>
          </dl>

          {lookupQuery.data.paymentNotes && (
            <p className={`mt-3 mb-0 small ${isSidebar ? "registration-sidebar-text" : "text-ink"}`}>
              <strong>Note:</strong> {lookupQuery.data.paymentNotes}
            </p>
          )}

          {canUploadReceipt && (
            <form
              onSubmit={handleReceiptUpload}
              className="mt-4 pt-3 border-top border-white border-opacity-10"
            >
              <p className={`small mb-2 ${isSidebar ? "registration-sidebar-text" : "text-ink"}`}>
                Upload proof of payment (
                {PAYMENT_STATUS_LABELS[lookupQuery.data.paymentStatus]})
                {lookupQuery.data.hasReceipt ? " — replaces the previous file" : ""}
              </p>
              <input
                type="file"
                accept="image/*,application/pdf"
                className={`mb-2 ${isSidebar ? "registration-sidebar-input" : "input-dark"}`}
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!receiptFile || loading}
                className={`btn-primary w-100 ${isSidebar ? "registration-sidebar-btn" : ""}`}
              >
                {loading ? "Uploading..." : "Submit Receipt"}
              </button>
            </form>
          )}

          {uploadError && (
            <p
              className={`mt-3 mb-0 small ${isSidebar ? "registration-sidebar-error" : "text-red-400"}`}
            >
              {uploadError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
