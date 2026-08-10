"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ConferenceEvent, SpecialInviteStatus, SpecialRole } from "@/lib/types/admin";
import { SPECIAL_INVITE_STATUS_LABELS, SPECIAL_ROLE_LABELS } from "@/lib/types/admin";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { PnaSelect } from "@/components/ui/PnaSelect";
import { MessageDialog } from "@/components/ui/MessageDialog";

type InviteRegistrationSummary = {
  id: string;
  referenceNumber: string;
  firstName: string;
  lastName: string;
  specialRole: SpecialRole | null;
  registeredAt: string;
};

type InviteRow = {
  id: string;
  token: string;
  email: string;
  eventId: string;
  eventTitle: string;
  status: SpecialInviteStatus;
  note: string;
  createdAt: string;
  sentAt: string | null;
  usedAt: string | null;
  inviteUrl: string;
  registration: InviteRegistrationSummary | null;
};

function formatWhen(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export function InvitesTable() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [events, setEvents] = useState<ConferenceEvent[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [email, setEmail] = useState("");
  const [eventId, setEventId] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<{ title: string; message: string; variant: "success" | "error" | "info" } | null>(
    null
  );
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  const loadInvites = useCallback(async () => {
    setListLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (statusFilter) params.set("status", statusFilter);
    if (eventFilter) params.set("eventId", eventFilter);
    const res = await fetch(`/api/admin/invites?${params.toString()}`);
    const data = await res.json();
    setInvites(data.invites ?? []);
    setListLoading(false);
  }, [searchQuery, statusFilter, eventFilter]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/events");
      const data = await res.json();
      const list = (data.events ?? []) as ConferenceEvent[];
      setEvents(list);
      if (list.length === 1) setEventId(list[0].id);
    })();
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  async function createInvite(e: FormEvent) {
    e.preventDefault();
    requestConfirm({
      title: "Send exclusive invite?",
      message: `Create a one-time complimentary registration link for ${email.trim()} and email it now?`,
      confirmLabel: "Create & send",
      loadingMessage: "Creating invite...",
      successTitle: "Invite created",
      successMessage: "The exclusive link was created.",
      showSuccess: false,
      action: async () => {
        const res = await fetch("/api/admin/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            eventId,
            note: note.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Could not create invite.");
        }
        setEmail("");
        setNote("");
        await loadInvites();
        setNotice({
          title: data.mailSent ? "Invite sent" : "Invite created",
          message: data.mailSent
            ? `Email sent to ${data.invite.email}.`
            : data.mailError ||
              "Invite saved. Copy the link from the table if email could not be sent.",
          variant: data.mailSent ? "success" : "info",
        });
      },
    });
  }

  function requestResend(invite: InviteRow) {
    const signedUp = invite.status === "used" && invite.registration;
    requestConfirm({
      title: signedUp ? "Resend confirmation email?" : "Resend invite email?",
      message: signedUp
        ? `Send the registration confirmation (with check-in QR) again to ${invite.email}?`
        : `Send the exclusive registration link again to ${invite.email}?`,
      confirmLabel: "Resend email",
      loadingMessage: "Sending email...",
      successTitle: signedUp ? "Confirmation resent" : "Invite resent",
      successMessage: signedUp
        ? `Confirmation email sent to ${invite.email}.`
        : `Invite email sent to ${invite.email}.`,
      action: async () => {
        const res = await fetch(`/api/admin/invites/${invite.id}/resend`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not resend email.");
        await loadInvites();
      },
    });
  }

  function requestRevoke(invite: InviteRow) {
    requestConfirm({
      title: "Revoke invite?",
      message: `Revoke the exclusive link for ${invite.email}? It will no longer open registration.`,
      confirmLabel: "Revoke invite",
      variant: "danger",
      loadingMessage: "Revoking invite...",
      successTitle: "Invite revoked",
      successMessage: "This link can no longer be used.",
      action: async () => {
        const res = await fetch(`/api/admin/invites/${invite.id}/revoke`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not revoke invite.");
        await loadInvites();
      },
    });
  }

  async function copyLink(invite: InviteRow) {
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setNotice({
        title: "Link copied",
        message: "The exclusive invite URL is on your clipboard.",
        variant: "success",
      });
    } catch {
      setNotice({
        title: "Could not copy",
        message: invite.inviteUrl,
        variant: "info",
      });
    }
  }

  const eventOptions = [
    { value: "", label: "Select event" },
    ...events.map((event) => ({ value: event.id, label: event.title })),
  ];

  return (
    <div className="admin-page">
      <LoadingOverlay show={loading} scope="local" variant="generic" />
      <ActionConfirmDialogs hook={confirmHook} />
      {notice ? (
        <MessageDialog
          open
          title={notice.title}
          message={notice.message}
          variant={notice.variant}
          onClose={() => setNotice(null)}
        />
      ) : null}

      <header className="admin-page-header mb-4">
        <div>
          <h1 className="admin-page-title">Special Invites</h1>
          <p className="admin-page-subtitle mb-0">
            Send one-time complimentary registration links for Committee and Speaker guests.
          </p>
        </div>
      </header>

      <section className="admin-card mb-4">
        <h2 className="admin-card-title">Create invite</h2>
        <form className="row g-3" onSubmit={createInvite}>
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="invite-email">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              className="form-control"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guest@example.com"
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="invite-event">
              Event
            </label>
            <PnaSelect
              id="invite-event"
              value={eventId}
              onChange={setEventId}
              options={eventOptions}
              placeholder="Select event"
              required
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="invite-note">
              Note (optional)
            </label>
            <input
              id="invite-note"
              type="text"
              className="form-control"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Shown in the invite email"
            />
          </div>
          <div className="col-12">
            <button type="submit" className="btn btn-primary" disabled={!email.trim() || !eventId}>
              Create &amp; send invite
            </button>
          </div>
        </form>
      </section>

      <section className="admin-card">
        <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
          <div className="flex-grow-1" style={{ minWidth: "12rem" }}>
            <label className="form-label" htmlFor="invite-search">
              Search
            </label>
            <input
              id="invite-search"
              className="form-control"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Email or event"
            />
          </div>
          <div style={{ minWidth: "10rem" }}>
            <label className="form-label" htmlFor="invite-status-filter">
              Status
            </label>
            <PnaSelect
              id="invite-status-filter"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: "All statuses" },
                { value: "pending", label: "Awaiting signup" },
                { value: "used", label: "Signed up" },
                { value: "revoked", label: "Revoked" },
              ]}
            />
          </div>
          <div style={{ minWidth: "12rem" }}>
            <label className="form-label" htmlFor="invite-event-filter">
              Event
            </label>
            <PnaSelect
              id="invite-event-filter"
              value={eventFilter}
              onChange={setEventFilter}
              options={[{ value: "", label: "All events" }, ...eventOptions.slice(1)]}
            />
          </div>
        </div>

        {listLoading ? (
          <TableSkeleton rows={6} columns={7} />
        ) : invites.length === 0 ? (
          <p className="text-muted mb-0">No special invites yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table admin-table mb-0">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Signed up</th>
                  <th>Sent</th>
                  <th>Used</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>
                      <div>{invite.email}</div>
                      {invite.note ? (
                        <div className="small text-muted">{invite.note}</div>
                      ) : null}
                    </td>
                    <td>{invite.eventTitle}</td>
                    <td>{SPECIAL_INVITE_STATUS_LABELS[invite.status]}</td>
                    <td>
                      {invite.registration ? (
                        <div>
                          <div className="fw-semibold">
                            {invite.registration.firstName} {invite.registration.lastName}
                          </div>
                          <div className="small text-muted">
                            {invite.registration.referenceNumber}
                            {invite.registration.specialRole
                              ? ` · ${SPECIAL_ROLE_LABELS[invite.registration.specialRole]}`
                              : ""}
                          </div>
                          <Link
                            href={`/admin/participants?q=${encodeURIComponent(invite.registration.referenceNumber)}`}
                            className="small admin-link"
                          >
                            View participant
                          </Link>
                        </div>
                      ) : invite.status === "used" ? (
                        <span className="text-muted small">Record missing</span>
                      ) : (
                        <span className="text-muted small">Not yet</span>
                      )}
                    </td>
                    <td>{formatWhen(invite.sentAt)}</td>
                    <td>{formatWhen(invite.usedAt)}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        {invite.status === "pending" ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => void copyLink(invite)}
                          >
                            Copy link
                          </button>
                        ) : null}
                        {invite.status === "pending" || invite.status === "used" ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => requestResend(invite)}
                          >
                            {invite.status === "used" ? "Resend confirmation" : "Resend invite"}
                          </button>
                        ) : null}
                        {invite.status === "pending" ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => requestRevoke(invite)}
                          >
                            Revoke
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
