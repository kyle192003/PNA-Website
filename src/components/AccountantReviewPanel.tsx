"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AccountantReviewItem } from "@/lib/accountant-review-types";
import { AccountantDocThumb } from "@/components/AccountantDocThumb";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { conference } from "@/lib/conference";

type QueueResponse = {
  expiresAt: string;
  reviewWindowNote: string;
  reasons: string[];
  queue: AccountantReviewItem[];
  error?: string;
};

function fileUrl(token: string, id: string, kind: string) {
  return `/api/accountant-review/files/${encodeURIComponent(id)}/${encodeURIComponent(kind)}?t=${encodeURIComponent(token)}`;
}

export function AccountantReviewPanel() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") ?? "";
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  const [queue, setQueue] = useState<AccountantReviewItem[]>([]);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const selected = useMemo(
    () => queue.find((item) => item.id === selectedId) ?? queue[0] ?? null,
    [queue, selectedId]
  );

  async function loadQueue() {
    setLoadingList(true);
    setLoadError("");
    try {
      if (!token) throw new Error("Missing review link. Open the link that was shared with you.");
      const res = await fetch(`/api/accountant-review?t=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as QueueResponse;
      if (!res.ok) throw new Error(data.error || "This review link is not available.");
      setQueue(data.queue ?? []);
      setReasons(data.reasons ?? []);
      setNote(data.reviewWindowNote ?? "");
      setExpiresAt(data.expiresAt ?? null);
      setSelectedId((current) => {
        const nextQueue = data.queue ?? [];
        if (current && nextQueue.some((item) => item.id === current)) return current;
        return nextQueue[0]?.id ?? null;
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "This review link is not available.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function requestApprove(item: AccountantReviewItem) {
    requestConfirm({
      title: "Approve this payment?",
      message: `Are you sure you want to approve the payment of ${item.name} (${item.referenceNumber})? This action is irreversible. The participant will be marked as paid and emailed their check-in QR.`,
      confirmLabel: "Approve payment",
      loadingMessage: "Approving payment...",
      successTitle: "Payment approved",
      successMessage: `${item.name} is now marked as paid. This cannot be undone from this link.`,
      action: async () => {
        const res = await fetch(`/api/accountant-review/${item.id}?t=${encodeURIComponent(token)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, paymentStatus: "paid" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not approve this payment.");
        await loadQueue();
      },
    });
  }

  function requestReject(item: AccountantReviewItem) {
    const reason = rejectReason.trim();
    if (!reason) return;

    requestConfirm({
      title: "Reject this payment proof?",
      message: `Reject the payment proof of ${item.name} (${item.referenceNumber}) for this reason: “${reason}” They will be emailed a one-time reupload link. After they submit a new receipt, that link expires and this payment returns to your 3-5 day review queue.`,
      confirmLabel: "Reject and email participant",
      variant: "danger",
      loadingMessage: "Rejecting payment...",
      successTitle: "Payment rejected",
      successMessage: `${item.name} was emailed a one-time reupload link.`,
      action: async () => {
        const res = await fetch(`/api/accountant-review/${item.id}?t=${encodeURIComponent(token)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            paymentStatus: "receipt_issue",
            paymentNotes: reason,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not reject this payment.");
        setRejectReason("");
        await loadQueue();
      },
    });
  }

  if (loadingList && queue.length === 0) {
    return (
      <div className="accountant-page">
        <div className="accountant-shell position-relative">
          <LoadingOverlay show scope="local" variant="form" />
          <p className="evaluation-card-desc mb-0">Loading payments for review...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="accountant-page">
        <div className="accountant-shell">
          <h1 className="evaluation-card-title font-display">Review link unavailable</h1>
          <p className="evaluation-form-error" role="alert">
            {loadError}
          </p>
          <p className="evaluation-card-desc mb-0">
            Contact the secretariat at{" "}
            <a href={`mailto:${conference.contact.email}`}>{conference.contact.email}</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="accountant-page">
      <LoadingOverlay show={loading} scope="local" variant="form" />
      <ActionConfirmDialogs hook={confirmHook} />

      <div className="accountant-shell">
        <header className="accountant-header">
          <div>
            <p className="folio-eyebrow folio-eyebrow--caps mb-1">Accountant review</p>
            <h1 className="evaluation-card-title font-display mb-2">Pending payments</h1>
            <p className="evaluation-card-desc mb-0 text-start">
              {note ||
                "Please review these payments within 3-5 days of submission. Approving a payment is irreversible."}
            </p>
          </div>
          <div className="accountant-header-meta">
            <strong>{queue.length}</strong> awaiting approval
            {expiresAt ? (
              <span>Link expires {new Date(expiresAt).toLocaleString()}</span>
            ) : null}
          </div>
        </header>

        {queue.length === 0 ? (
          <p className="evaluation-card-done mb-0">
            There are no receipts waiting for approval right now.
          </p>
        ) : (
          <div className="accountant-layout">
            <aside className="accountant-queue" aria-label="Payments awaiting approval">
              {queue.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`accountant-queue-item${item.id === selected?.id ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="accountant-queue-name">{item.name}</span>
                  <span className="accountant-queue-meta">
                    {item.referenceNumber} · {item.paymentAmountLabel}
                  </span>
                </button>
              ))}
            </aside>

            {selected ? (
              <section className="accountant-detail">
                <div className="accountant-detail-head">
                  <div>
                    <h2 className="accountant-detail-title">{selected.name}</h2>
                    <p className="admin-muted mb-0">
                      {selected.referenceNumber} · {selected.eventTitle}
                    </p>
                  </div>
                  <span className="admin-status-badge admin-status-badge--receipt_submitted">
                    {selected.paymentStatusLabel}
                  </span>
                </div>

                <dl className="accountant-facts">
                  {[
                    ["Email", selected.email],
                    ["Phone", selected.phone],
                    ["Date of birth", selected.dateOfBirth || "—"],
                    ["Age", selected.age != null ? String(selected.age) : "—"],
                    ["Gender", selected.gender || "—"],
                    ["Organization", selected.organization || "—"],
                    ["Institution address", selected.institutionAddress || "—"],
                    ["Position", selected.position || "—"],
                    ["Membership", selected.membershipTypeLabel],
                    ["PNA ID", selected.pnaIdNumber || "—"],
                    ["PNA zone", selected.pnaZone || "—"],
                    ["PNA chapter", selected.pnaChapter || "—"],
                    ["PRC license", selected.prcLicenseNumber || "—"],
                    ["PRC initial registration", selected.prcInitialRegistrationDate || "—"],
                    ["PRC expiration", selected.prcExpirationDate || "—"],
                    ["Registration mode", selected.registrationMode || "—"],
                    ["Fee", `${selected.paymentAmountLabel}${selected.feeLabel ? ` (${selected.feeLabel})` : ""}`],
                    ["Special role", selected.specialRoleLabel || "—"],
                    ["Senior/PWD ID no.", selected.seniorPwdIdNumber || "—"],
                    ["Sales invoice", selected.wantsSalesInvoice ? "Requested" : "Not requested"],
                    ["BIR 2303 institution", selected.bir2303InstitutionName || "—"],
                    ["Receipt named under", selected.receiptNamedUnder || "—"],
                    ["Food preference", selected.foodPreferenceLabel],
                    ["Food allergy note", selected.foodAllergyNote || "—"],
                    ["Payment reference", selected.paymentReference || "—"],
                    [
                      "Receipt uploaded",
                      selected.receiptUploadedAt
                        ? new Date(selected.receiptUploadedAt).toLocaleString()
                        : "—",
                    ],
                    [
                      "Registered",
                      selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—",
                    ],
                    ["Group size", selected.groupSize ? String(selected.groupSize) : "Single"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="accountant-docs">
                  <h3 className="accountant-docs-title">Attached documents</h3>
                  <p className="admin-muted">
                    Images are shown at a fixed size. Click an image or its caption to zoom in.
                  </p>
                  <div className="accountant-docs-grid">
                    {selected.documents
                      .filter((doc) => doc.present)
                      .map((doc) => (
                        <AccountantDocThumb
                          key={doc.kind}
                          src={fileUrl(token, selected.id, doc.kind)}
                          label={doc.label}
                          isPdf={doc.isPdf}
                        />
                      ))}
                  </div>
                  {selected.documents.every((doc) => !doc.present) ? (
                    <p className="admin-muted mb-0">No documents were uploaded.</p>
                  ) : null}
                </div>

                <div className="accountant-actions">
                  <button
                    type="button"
                    className="admin-action-btn admin-action-btn--paid"
                    onClick={() => requestApprove(selected)}
                    disabled={loading}
                  >
                    Approve payment
                  </button>

                  <div className="accountant-reject">
                    <p className="admin-label mb-2">Reject payment — choose a reason</p>
                    <div className="admin-receipt-reason-list">
                      {reasons.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          className={`admin-receipt-reason-chip${
                            rejectReason === reason ? " is-selected" : ""
                          }`}
                          onClick={() => setRejectReason(reason)}
                          disabled={loading}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="admin-action-btn admin-action-btn--reject mt-2"
                      onClick={() => requestReject(selected)}
                      disabled={loading || !rejectReason.trim()}
                    >
                      Reject and send reupload email
                    </button>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
