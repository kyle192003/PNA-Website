"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContactInquiry, InquiryStatus } from "@/lib/types/admin";
import { INQUIRY_STATUS_LABELS } from "@/lib/types/admin";
import { InquiryStatusBadge } from "@/components/admin/InquiryStatusBadge";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { PnaSelect } from "@/components/ui/PnaSelect";

function notifyInquiriesUpdated() {
  window.dispatchEvent(new CustomEvent("admin-inquiries-updated"));
}

export function InquiriesTable({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<ContactInquiry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  const syncUrl = useCallback(
    (nextQuery: string) => {
      const params = new URLSearchParams();
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      const queryString = params.toString();
      router.replace(queryString ? `/admin/inquiries?${queryString}` : "/admin/inquiries", {
        scroll: false,
      });
    },
    [router]
  );

  const loadInquiries = useCallback(async () => {
    setListLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/admin/inquiries?${params.toString()}`);
    const data = await res.json();
    setInquiries(data.inquiries ?? []);
    setListLoading(false);
    notifyInquiriesUpdated();
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchQuery(trimmed);
      syncUrl(trimmed);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput, syncUrl]);

  function openInquiry(inquiry: ContactInquiry) {
    setSelected(inquiry);
    setReplyDraft("");
    setReplyError(null);
    setReplySuccess(null);
    requestAnimationFrame(() => setDetailOpen(true));
    if (inquiry.status === "new") {
      void markAsRead(inquiry.id, false);
    }
  }

  async function sendReply() {
    if (!selected) return;
    const message = replyDraft.trim();
    if (!message) {
      setReplyError("Write a reply before sending.");
      setReplySuccess(null);
      return;
    }

    setReplySending(true);
    setReplyError(null);
    setReplySuccess(null);
    try {
      const res = await fetch(`/api/admin/inquiries/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send reply.");
      }

      setSelected(data.inquiry);
      setReplyDraft("");
      setReplySuccess(data.message ?? "Reply sent.");
      setInquiries((current) =>
        current.map((inquiry) => (inquiry.id === data.inquiry.id ? data.inquiry : inquiry))
      );
      notifyInquiriesUpdated();
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Failed to send reply.");
    } finally {
      setReplySending(false);
    }
  }

  async function markAsRead(id: string, reload = true) {
    const res = await fetch(`/api/admin/inquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "read" }),
    });
    const data = await res.json();
    if (!res.ok) return;

    setSelected((current) => (current?.id === id ? data.inquiry : current));
    if (reload) await loadInquiries();
    else {
      setInquiries((current) =>
        current.map((inquiry) => (inquiry.id === id ? data.inquiry : inquiry))
      );
      notifyInquiriesUpdated();
    }
  }

  async function markAsNew(id: string) {
    const res = await fetch(`/api/admin/inquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "new" }),
    });
    const data = await res.json();
    if (!res.ok) return;

    setSelected(data.inquiry);
    await loadInquiries();
  }

  function requestDelete(inquiry: ContactInquiry) {
    requestConfirm({
      title: "Delete inquiry?",
      message: `Are you sure you want to delete the inquiry from ${inquiry.name}? This cannot be undone.`,
      confirmLabel: "Delete inquiry",
      variant: "danger",
      loadingMessage: "Deleting inquiry...",
      successTitle: "Inquiry deleted",
      successMessage: "The inquiry was removed from your inbox.",
      action: async () => {
        const res = await fetch(`/api/admin/inquiries/${inquiry.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to delete inquiry.");
        }

        if (selected?.id === inquiry.id) {
          setDetailOpen(false);
          setSelected(null);
        }
        await loadInquiries();
      },
    });
  }

  const newCount = inquiries.filter((inquiry) => inquiry.status === "new").length;

  function closeDetail() {
    setDetailOpen(false);
  }

  function handleDetailTransitionEnd(event: React.TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== "opacity" && event.propertyName !== "max-height") return;
    if (!detailOpen) setSelected(null);
  }

  useEffect(() => {
    if (!detailOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDetailOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [detailOpen]);

  return (
    <div className="admin-page admin-inquiries">
      <LoadingOverlay show={loading} scope="local" variant="form" />
      <ActionConfirmDialogs hook={confirmHook} />

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display">Inquiries</h1>
          <p className="admin-muted">
            Contact form submissions from the public site.
            {newCount > 0 && !statusFilter && !searchQuery ? (
              <> {newCount} new {newCount === 1 ? "inquiry" : "inquiries"}.</>
            ) : null}
          </p>
        </div>

        <label className="admin-participants-search">
          <svg className="admin-participants-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
            <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, mobile..."
            aria-label="Search inquiries"
            disabled={loading}
          />
        </label>
      </div>

      <div className="admin-participants-toolbar">
        <label className="admin-participants-filter">
          <span className="admin-label">Status</span>
          <PnaSelect
            className="admin-select"
            value={statusFilter}
            onChange={setStatusFilter}
            disabled={listLoading || loading}
            aria-label="Filter by inquiry status"
            options={[
              { value: "", label: "All statuses" },
              ...(Object.keys(INQUIRY_STATUS_LABELS) as InquiryStatus[]).map((status) => ({
                value: status,
                label: INQUIRY_STATUS_LABELS[status],
              })),
            ]}
          />
        </label>
      </div>

      <div className={`admin-split ${detailOpen ? "admin-split--with-detail" : ""}`}>
        <div className="admin-card admin-table-wrap">
          {listLoading && inquiries.length === 0 ? (
            <TableSkeleton rows={8} columns={5} />
          ) : inquiries.length === 0 ? (
            <p className="admin-muted p-3">
              No inquiries found{searchQuery ? " matching your search" : ""}.
            </p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inquiry) => (
                  <tr
                    key={inquiry.id}
                    className={selected?.id === inquiry.id && detailOpen ? "selected" : ""}
                    onClick={() => openInquiry(inquiry)}
                  >
                    <td>{new Date(inquiry.createdAt).toLocaleDateString()}</td>
                    <td>{inquiry.name}</td>
                    <td>{inquiry.email}</td>
                    <td>{inquiry.mobile}</td>
                    <td>
                      <InquiryStatusBadge status={inquiry.status} />
                    </td>
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
                <h3 className="admin-card-title font-display mb-1">{selected.name}</h3>
                <p className="admin-muted mb-0">
                  Received {new Date(selected.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                className="admin-detail-close"
                aria-label="Close inquiry details"
                onClick={closeDetail}
              >
                ×
              </button>
            </div>

            <dl className="admin-detail-list">
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${selected.email}`}>{selected.email}</a>
                </dd>
              </div>
              <div>
                <dt>Mobile</dt>
                <dd>
                  <a href={`tel:${selected.mobile}`}>{selected.mobile}</a>
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <InquiryStatusBadge status={selected.status} />
                </dd>
              </div>
            </dl>

            <div className="admin-detail-message">
              <p className="admin-label">Message</p>
              <p className="admin-detail-message-body">{selected.message}</p>
            </div>

            <div className="admin-inquiry-reply">
              <label className="admin-label" htmlFor="inquiry-reply">
                Reply by email
              </label>
              <textarea
                id="inquiry-reply"
                className="admin-inquiry-reply-textarea"
                value={replyDraft}
                onChange={(event) => {
                  setReplyDraft(event.target.value);
                  if (replyError) setReplyError(null);
                  if (replySuccess) setReplySuccess(null);
                }}
                placeholder="Write your reply. This will be sent with the same PNA email template."
                disabled={replySending || loading}
                maxLength={5000}
              />
              <p className="admin-inquiry-reply-hint">
                Sends through the website SMTP mailer using the branded PNA template.
              </p>
              {replyError ? <p className="admin-inquiry-reply-error">{replyError}</p> : null}
              {replySuccess ? <p className="admin-inquiry-reply-success">{replySuccess}</p> : null}
              <div className="admin-inquiry-reply-actions">
                <button
                  type="button"
                  className="admin-action-btn admin-action-btn--paid"
                  onClick={() => void sendReply()}
                  disabled={replySending || loading || !replyDraft.trim()}
                >
                  {replySending ? "Sending..." : "Send reply"}
                </button>
              </div>

              {(selected.replies?.length ?? 0) > 0 ? (
                <div className="admin-inquiry-reply-history">
                  <p className="admin-label mb-0">Sent replies</p>
                  {[...(selected.replies ?? [])].reverse().map((reply) => (
                    <div key={reply.id} className="admin-inquiry-reply-item">
                      <p className="admin-inquiry-reply-meta">
                        Sent {new Date(reply.sentAt).toLocaleString()}
                      </p>
                      <p className="admin-inquiry-reply-body">{reply.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="admin-action-grid">
              {selected.status === "read" || selected.status === "replied" ? (
                <button
                  type="button"
                  className="admin-action-btn admin-action-btn--pending"
                  onClick={() => markAsNew(selected.id)}
                  disabled={loading || replySending}
                >
                  Mark as new
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-action-btn admin-action-btn--paid"
                  onClick={() => markAsRead(selected.id)}
                  disabled={loading || replySending}
                >
                  Mark as read
                </button>
              )}
              <button
                type="button"
                className="admin-action-btn admin-action-btn--reject"
                onClick={() => requestDelete(selected)}
                disabled={loading || replySending}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
