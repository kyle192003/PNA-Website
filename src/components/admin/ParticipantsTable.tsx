"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConferenceEvent, PaymentStatus, RegistrationRecord } from "@/lib/types/admin";
import { PAYMENT_STATUS_LABELS } from "@/lib/types/admin";
import { formatParticipantName } from "@/lib/participant-name";
import { AdminBillInsights } from "@/components/admin/AdminBillInsights";
import { AdminExportMenu } from "@/components/admin/AdminExportMenu";
import { AdminHorizontalBarChart } from "@/components/admin/dashboard/AdminBarCharts";
import { PaymentStatusBadge } from "@/components/admin/PaymentStatusBadge";
import { AdminReceiptPreview } from "@/components/admin/AdminReceiptPreview";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { PnaSelect } from "@/components/ui/PnaSelect";
import type { ParticipantInsightStats } from "@/lib/financial-types";
import { formatPeso } from "@/lib/registration-fees";
import { conference } from "@/lib/conference";

const statusConfirmCopy: Record<
  PaymentStatus,
  { title: string; message: string; confirmLabel: string; variant?: "default" | "danger" }
> = {
  paid: {
    title: "Mark as paid?",
    message: "Are you sure you want to mark this participant as paid?",
    confirmLabel: "Mark paid",
  },
  receipt_issue: {
    title: "Flag receipt issue?",
    message:
      "Are you sure you want to flag a receipt issue? The participant will be notified to re-upload.",
    confirmLabel: "Flag issue",
  },
  pending: {
    title: "Reset to pending?",
    message: "Are you sure you want to reset this participant's payment status to pending?",
    confirmLabel: "Reset pending",
  },
  rejected: {
    title: "Reject payment?",
    message: "Are you sure you want to reject this participant's payment?",
    confirmLabel: "Reject payment",
    variant: "danger",
  },
  receipt_submitted: {
    title: "Update status?",
    message: "Are you sure you want to update this participant's status?",
    confirmLabel: "Update status",
  },
};

const statusSuccessCopy: Record<
  PaymentStatus,
  { title: string; message: string }
> = {
  paid: {
    title: "Participant marked as paid",
    message:
      "Payment confirmed. The participant will receive their check-in QR by email (if mail is configured).",
  },
  receipt_issue: {
    title: "Receipt issue flagged",
    message: "The participant has been notified to re-upload their payment proof.",
  },
  pending: {
    title: "Status reset to pending",
    message: "The participant's payment status was reset to pending.",
  },
  rejected: {
    title: "Payment rejected",
    message: "The participant's payment status was updated to rejected.",
  },
  receipt_submitted: {
    title: "Status updated",
    message: "The participant's payment status was updated successfully.",
  },
};

/** One-click reasons: selecting one flags the issue and emails the participant. */
const RECEIPT_ISSUE_REASONS = [
  "Receipt is blurry — please re-upload a clearer photo.",
  "Reference number is missing or unreadable on the receipt.",
  "Amount does not match the registration fee.",
  "Incomplete proof — please upload the full receipt/screenshot.",
] as const;

export function ParticipantsTable({
  events,
  initialQuery = "",
  initialEventId = "",
  participantCounts = {},
  insights,
}: {
  events: ConferenceEvent[];
  initialQuery?: string;
  initialEventId?: string;
  participantCounts?: Record<string, number>;
  insights: ParticipantInsightStats;
}) {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [eventId, setEventId] = useState(initialEventId);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<RegistrationRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [underReviewCount, setUnderReviewCount] = useState(0);
  const [adminNotes, setAdminNotes] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId) ?? null,
    [events, eventId]
  );

  const showUnassignedTab = (participantCounts.unassigned ?? 0) > 0;

  const syncUrl = useCallback(
    (nextEventId: string, nextQuery: string) => {
      const params = new URLSearchParams();
      if (nextEventId) params.set("eventId", nextEventId);
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      const queryString = params.toString();
      router.replace(queryString ? `/admin/participants?${queryString}` : "/admin/participants", {
        scroll: false,
      });
    },
    [router]
  );

  const loadParticipants = useCallback(async () => {
    if (!eventId) {
      setRegistrations([]);
      setListLoading(false);
      return;
    }

    setListLoading(true);
    const params = new URLSearchParams();
    params.set("eventId", eventId);
    if (searchQuery) params.set("q", searchQuery);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/admin/participants?${params.toString()}`);
    const data = await res.json();
    setRegistrations(data.registrations ?? []);
    setListLoading(false);
  }, [eventId, searchQuery, statusFilter]);

  const loadUnderReviewCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/participants/count");
      if (!res.ok) return;
      const data = (await res.json()) as { underReviewCount?: number };
      setUnderReviewCount(data.underReviewCount ?? 0);
    } catch {
      // Ignore transient fetch issues; table still works.
    }
  }, []);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  useEffect(() => {
    void loadUnderReviewCount();
  }, [loadUnderReviewCount]);

  useEffect(() => {
    setDetailOpen(false);
    setSelected(null);
  }, [eventId]);

  function handleEventChange(nextEventId: string) {
    setEventId(nextEventId);
    syncUrl(nextEventId, searchQuery);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchQuery(trimmed);
      syncUrl(eventId, trimmed);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput, eventId, syncUrl]);

  function openParticipant(participant: RegistrationRecord) {
    setSelected(participant);
    setAdminNotes(participant.adminNotes);
    setPaymentNotes(participant.paymentNotes);
    setFormError(null);
    requestAnimationFrame(() => setDetailOpen(true));
  }

  function closeDetail() {
    setDetailOpen(false);
  }

  function handleDetailTransitionEnd(event: React.TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== "opacity" && event.propertyName !== "max-height") return;
    if (!detailOpen) {
      setSelected(null);
      setAdminNotes("");
      setPaymentNotes("");
      setFormError(null);
    }
  }

  useEffect(() => {
    if (!detailOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDetailOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [detailOpen]);

  function requestDeleteParticipant() {
    if (!selected) return;

    const name = formatParticipantName(selected);

    requestConfirm({
      title: "Remove participant?",
      message: `Permanently remove ${name} (${selected.referenceNumber})? This cannot be undone. They can register again later with the same email.`,
      confirmLabel: "Remove participant",
      variant: "danger",
      loadingMessage: "Removing participant...",
      successTitle: "Participant removed",
      successMessage: "The participant was removed from this event.",
      action: async () => {
        const res = await fetch(`/api/admin/participants/${selected.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to remove participant.");
        }

        setDetailOpen(false);
        setSelected(null);
        setFormError(null);
        await loadParticipants();
        await loadUnderReviewCount();
      },
    });
  }

  function requestStatusUpdate(
    paymentStatus: PaymentStatus,
    notesOverride?: string
  ) {
    if (!selected) return;

    const notesForRequest =
      typeof notesOverride === "string" ? notesOverride.trim() : paymentNotes.trim();

    if (
      (paymentStatus === "rejected" || paymentStatus === "receipt_issue") &&
      !notesForRequest
    ) {
      setFormError(
        "Enter a message in “Message to Participant” (e.g. blurry receipt) before continuing."
      );
      return;
    }

    if (typeof notesOverride === "string") {
      setPaymentNotes(notesOverride);
    }

    setFormError(null);

    const copy = statusConfirmCopy[paymentStatus];
    const successCopy = statusSuccessCopy[paymentStatus];
    const notifiesParticipant =
      paymentStatus === "rejected" || paymentStatus === "receipt_issue";
    const resendReceiptEmail =
      paymentStatus === "receipt_issue" && selected.paymentStatus === "receipt_issue";
    const isGroup = Boolean(selected.groupId);
    const groupNote = isGroup
      ? selected.groupSize
        ? ` This updates all ${selected.groupSize} participants in the group.`
        : " This updates all participants in the group."
      : "";

    requestConfirm({
      title: copy.title,
      message: notifiesParticipant
        ? `${copy.message} The participant will receive an email with your message and a reupload link.${groupNote}`
        : `${copy.message}${groupNote}`,
      confirmLabel: copy.confirmLabel,
      variant: copy.variant,
      loadingMessage: isGroup ? "Updating group payment status..." : "Updating participant...",
      successTitle: successCopy.title,
      successMessage: notifiesParticipant
        ? isGroup
          ? "Group status updated and participants were emailed (if mail is configured)."
          : "Status updated and the participant was emailed (if mail is configured)."
        : isGroup
          ? "Group payment status updated."
          : successCopy.message,
      action: async () => {
        const res = await fetch(`/api/admin/participants/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentStatus,
            adminNotes,
            paymentNotes: notesForRequest,
            resendReceiptEmail,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to update participant.");
        }

        setSelected(data.registration);
        await loadParticipants();
        await loadUnderReviewCount();
      },
    });
  }

  function requestReceiptIssueReason(reason: string) {
    requestStatusUpdate("receipt_issue", reason);
  }

  return (
    <div className="admin-page admin-participants">
      <LoadingOverlay show={loading} scope="local" variant="form" />
      <ActionConfirmDialogs hook={confirmHook} />

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display">Participants</h1>
          <p className="admin-muted">Track ticket purchases and review payment receipts.</p>
        </div>

        <div className="admin-page-header-actions">
          <label className="admin-participants-search">
            <svg className="admin-participants-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
              <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search surname, name, reference..."
              aria-label="Search participants by surname, name, or reference"
              disabled={loading}
            />
          </label>
          <AdminExportMenu type="participants" eventId={eventId || null} />
        </div>
      </div>

      <AdminBillInsights
        title="Participant overview"
        subtitle={selectedEvent?.title ?? "Selected registrations"}
        highlightLabel="Total registered"
        highlightValue={String(insights.total)}
        highlightHint={`${insights.paid} paid · ${insights.checkedIn} checked in`}
        metrics={[
          { label: "Paid", value: insights.paid },
          { label: "Pending", value: insights.pending },
          { label: "Under review", value: insights.underReview },
          { label: "Checked in", value: insights.checkedIn },
        ]}
        chartTitle="Registrations this week"
        chartData={insights.byDay}
        chartMode="vertical"
        breakdownTitle="By payment status"
        breakdown={insights.byStatus.map((item) => ({
          label: item.label,
          value: String(item.value),
        }))}
      />

      {insights.byCategory.length > 0 ? (
        <section className="admin-card admin-participants-category-chart mb-3">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">By category</h2>
              <p className="admin-muted mb-0">How participants are distributed across fee types</p>
            </div>
          </div>
          <div className="p-3 pt-0">
            <AdminHorizontalBarChart data={insights.byCategory} />
          </div>
        </section>
      ) : null}

      {underReviewCount > 0 && (
        <div className="admin-card admin-participants-review-banner" role="status">
          <strong>{underReviewCount}</strong> applicant{underReviewCount === 1 ? "" : "s"} {underReviewCount === 1 ? "is" : "are"} under receipt review.
          <span> Use the Status filter and choose “Receipt Under Review” to process them first.</span>
        </div>
      )}

      {events.length === 0 && !showUnassignedTab ? (
        <div className="admin-card admin-participants-empty">
          <p className="admin-muted mb-0">
            Create an event first before managing participant registrations.
          </p>
        </div>
      ) : (
        <>
          <div className="admin-participants-toolbar">
            <label className="admin-participants-filter">
              <span className="admin-label">Status</span>
              <PnaSelect
                className="admin-select"
                value={statusFilter}
                onChange={setStatusFilter}
                disabled={listLoading || loading}
                aria-label="Filter by payment status"
                options={[
                  { value: "", label: "All statuses" },
                  ...(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((status) => ({
                    value: status,
                    label: PAYMENT_STATUS_LABELS[status],
                  })),
                ]}
              />
            </label>

            <label className="admin-participants-filter">
              <span className="admin-label">Event</span>
              <PnaSelect
                className="admin-select"
                value={eventId}
                onChange={handleEventChange}
                disabled={listLoading || loading}
                aria-label="Filter by event"
                options={[
                  ...events.map((event) => ({
                    value: event.id,
                    label: `${event.title} (${participantCounts[event.id] ?? 0})`,
                  })),
                  ...(showUnassignedTab
                    ? [
                        {
                          value: "unassigned",
                          label: `Unassigned (${participantCounts.unassigned ?? 0})`,
                        },
                      ]
                    : []),
                ]}
              />
            </label>
          </div>

      <div className={`admin-split ${detailOpen ? "admin-split--with-detail" : ""}`}>
        <div className="admin-card admin-table-wrap">
          {listLoading && registrations.length === 0 ? (
            <TableSkeleton rows={8} columns={6} />
          ) : registrations.length === 0 ? (
            <p className="admin-muted p-3">
              No participants found for this event{searchQuery ? " matching your search" : ""}.
            </p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                    <th>Reference</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((participant) => (
                  <tr
                    key={participant.id}
                    className={selected?.id === participant.id && detailOpen ? "selected" : ""}
                    onClick={() => openParticipant(participant)}
                  >
                    <td>{participant.referenceNumber}</td>
                    <td>
                      {formatParticipantName(participant)}
                      {participant.groupId ? (
                        <span className="admin-group-badge" title="Group registration">
                          Group{participant.groupSize ? ` · ${participant.groupSize}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {participant.feeLabel?.trim() ||
                        (conference.registration.fees as Record<string, { label?: string }>)[
                          participant.category
                        ]?.label ||
                        participant.category}
                    </td>
                    <td>{formatPeso(participant.paymentAmount ?? 0)}</td>
                    <td>
                      <PaymentStatusBadge status={participant.paymentStatus} />
                    </td>
                    <td>{new Date(participant.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div
            className={`admin-card admin-detail-panel ${detailOpen ? "admin-detail-panel--open" : ""}`}
            onTransitionEnd={handleDetailTransitionEnd}
          >
            <div className="admin-detail-panel-header">
              <div className="admin-detail-panel-header-text">
                <h3 className="admin-card-title font-display mb-1">
                  {formatParticipantName(selected)}
                </h3>
                <p className="admin-muted mb-0">
                  {selected.referenceNumber}
                  {selected.groupId ? (
                    <span className="admin-group-badge">
                      Group{selected.groupSize ? ` · ${selected.groupSize}` : ""}
                      {selected.groupRole === "primary" ? " · primary" : ""}
                    </span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                className="admin-detail-close"
                aria-label="Close participant details"
                onClick={closeDetail}
              >
                ×
              </button>
            </div>

            <dl className="admin-detail-list">
              {selectedEvent && (
                <div>
                  <dt>Event</dt>
                  <dd>{selectedEvent.title}</dd>
                </div>
              )}
              <div>
                <dt>Email</dt>
                <dd>{selected.email}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{selected.phone}</dd>
              </div>
              <div>
                <dt>Organization</dt>
                <dd>{selected.organization}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <PaymentStatusBadge status={selected.paymentStatus} />
                </dd>
              </div>
              <div>
                <dt>Payment amount</dt>
                <dd>
                  {formatPeso(selected.paymentAmount ?? 0)}
                  {selected.feeLabel ? ` (${selected.feeLabel})` : ""}
                </dd>
              </div>
              <div>
                <dt>Payment reference</dt>
                <dd>{selected.paymentReference?.trim() || "—"}</dd>
              </div>
              {selected.seniorPwdIdNumber ? (
                <div>
                  <dt>Senior/PWD ID number</dt>
                  <dd>{selected.seniorPwdIdNumber}</dd>
                </div>
              ) : null}
              <div>
                <dt>Category / rate</dt>
                <dd>
                  {selected.feeLabel?.trim() ||
                    (conference.registration.fees as Record<string, { label?: string }>)[
                      selected.category
                    ]?.label ||
                    selected.category}
                </dd>
              </div>
            </dl>

            <AdminReceiptPreview
              registrationId={selected.id}
              receiptUrl={selected.receiptUrl}
              receiptUploadedAt={selected.receiptUploadedAt}
              referenceNumber={selected.referenceNumber}
              paymentReference={selected.paymentReference}
            />

            <div className="admin-registration-docs mt-3">
              <p className="admin-label mb-2">Uploaded documents</p>
              <div className="d-flex flex-wrap gap-2">
                {(
                  [
                    ["pnaId", "PNA ID", selected.pnaIdUrl],
                    ["prcId", "PRC ID", selected.prcIdUrl],
                    ["bir2303", "BIR 2303", selected.bir2303Url],
                    ["bir2307", "BIR 2307", selected.bir2307Url],
                    ["seniorPwdId", "Senior/PWD ID", selected.seniorPwdIdUrl],
                  ] as const
                ).map(([kind, label, url]) =>
                  url ? (
                    <a
                      key={kind}
                      className="admin-link-btn"
                      href={`/api/admin/registration-docs/${encodeURIComponent(selected.id)}/${kind}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {label}
                    </a>
                  ) : (
                    <span key={kind} className="admin-muted small">
                      {label}: —
                    </span>
                  )
                )}
              </div>
            </div>

            <label className="admin-label mt-3">Admin Notes</label>
            <textarea
              className="admin-input"
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              disabled={listLoading || loading}
            />

            <label className="admin-label mt-2">
              Message to Participant
              <span className="admin-muted"> (click a reason to email a reupload link)</span>
            </label>
            <div className="admin-receipt-reason-list" role="list">
              {RECEIPT_ISSUE_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  role="listitem"
                  className={`admin-receipt-reason-chip${
                    paymentNotes.trim() === reason ? " is-selected" : ""
                  }`}
                  disabled={listLoading || loading}
                  onClick={() => requestReceiptIssueReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
            <textarea
              className="admin-input"
              rows={2}
              value={paymentNotes}
              onChange={(e) => {
                setPaymentNotes(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="Or type a custom message, then use Receipt Issue / Reject."
              disabled={listLoading || loading}
            />

            {formError && (
              <p className="text-danger small mt-2 mb-0" role="alert">
                {formError}
              </p>
            )}

            {selected.checkInStatus === "checked_in" && (
              <p className="admin-muted mt-2 mb-0">
                Checked in
                {selected.checkedInAt
                  ? ` · ${new Date(selected.checkedInAt).toLocaleString()}`
                  : ""}
              </p>
            )}

            <div className="admin-action-grid">
              <button
                type="button"
                className="admin-action-btn admin-action-btn--paid"
                disabled={listLoading || loading}
                onClick={() => requestStatusUpdate("paid")}
              >
                Mark Paid
              </button>
              <button
                type="button"
                className="admin-action-btn admin-action-btn--issue"
                disabled={listLoading || loading}
                onClick={() => requestStatusUpdate("receipt_issue")}
              >
                Receipt Issue
              </button>
              <button
                type="button"
                className="admin-action-btn admin-action-btn--pending"
                disabled={listLoading || loading}
                onClick={() => requestStatusUpdate("pending")}
              >
                Reset Pending
              </button>
              <button
                type="button"
                className="admin-action-btn admin-action-btn--reject"
                disabled={listLoading || loading}
                onClick={() => requestStatusUpdate("rejected")}
              >
                Reject
              </button>
              <button
                type="button"
                className="admin-action-btn admin-action-btn--delete"
                disabled={listLoading || loading}
                onClick={requestDeleteParticipant}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
