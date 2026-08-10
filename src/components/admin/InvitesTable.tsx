"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import type { ConferenceEvent, SpecialInviteStatus, SpecialRole } from "@/lib/types/admin";
import {
  SPECIAL_INVITE_STATUS_LABELS,
  SPECIAL_ROLE_LABELS,
  SPECIAL_ROLE_SHORT_LABELS,
} from "@/lib/types/admin";
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
  firstName: string;
  specialRole: SpecialRole | null;
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

type DraftInvite = {
  localId: string;
  firstName: string;
  email: string;
  specialRole: SpecialRole | "";
  parseWarning?: string;
  sendError?: string;
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

function createLocalId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function InvitesTable() {
  const importInputId = useId();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [events, setEvents] = useState<ConferenceEvent[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [specialRole, setSpecialRole] = useState<SpecialRole | "">("");
  const [eventId, setEventId] = useState("");
  const [drafts, setDrafts] = useState<DraftInvite[]>([]);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    variant: "success" | "error" | "info";
  } | null>(null);
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
      const list = ((data.events ?? []) as ConferenceEvent[]).filter(
        (event) => event.status !== "finished"
      );
      setEvents(list);
      if (list.length === 1) setEventId(list[0].id);
      else setEventId((current) => (list.some((event) => event.id === current) ? current : ""));
      setEventFilter((current) => (list.some((event) => event.id === current) ? current : ""));
    })();
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  function addDraftFromForm(e: FormEvent) {
    e.preventDefault();
    const nextFirstName = firstName.trim();
    const nextEmail = email.trim().toLowerCase();
    if (!nextFirstName || !nextEmail || !specialRole) {
      setNotice({
        title: "Missing details",
        message: "First name, email, and role are required before adding to the send list.",
        variant: "error",
      });
      return;
    }
    if (!isValidEmail(nextEmail)) {
      setNotice({
        title: "Invalid email",
        message: "Please enter a valid email address.",
        variant: "error",
      });
      return;
    }

    setDrafts((current) => [
      ...current,
      {
        localId: createLocalId(),
        firstName: nextFirstName,
        email: nextEmail,
        specialRole,
      },
    ]);
    setFirstName("");
    setEmail("");
    setSpecialRole("");
  }

  function updateDraft(localId: string, patch: Partial<DraftInvite>) {
    setDrafts((current) =>
      current.map((row) => (row.localId === localId ? { ...row, ...patch, sendError: undefined } : row))
    );
  }

  function removeDraft(localId: string) {
    setDrafts((current) => current.filter((row) => row.localId !== localId));
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/admin/invites/parse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not import file.");
      }

      const imported = (data.rows ?? []).map(
        (row: {
          firstName?: string;
          email?: string;
          specialRole?: SpecialRole | "";
          parseWarning?: string;
        }) =>
          ({
            localId: createLocalId(),
            firstName: row.firstName?.trim() ?? "",
            email: (row.email ?? "").trim().toLowerCase(),
            specialRole: row.specialRole === "committee" || row.specialRole === "speaker" ? row.specialRole : "",
            parseWarning: row.parseWarning,
          }) satisfies DraftInvite
      );

      setDrafts((current) => [...current, ...imported]);
      setNotice({
        title: "Import ready for review",
        message:
          data.message ||
          `Loaded ${imported.length} row${imported.length === 1 ? "" : "s"}. Nothing has been sent yet.`,
        variant: "info",
      });
    } catch (error) {
      setNotice({
        title: "Import failed",
        message: error instanceof Error ? error.message : "Could not import file.",
        variant: "error",
      });
    } finally {
      setImporting(false);
    }
  }

  function requestSendDrafts() {
    if (!eventId) {
      setNotice({
        title: "Select an event",
        message: "Choose which event these exclusive invites belong to before sending.",
        variant: "error",
      });
      return;
    }

    const invalid = drafts.filter(
      (row) =>
        !row.firstName.trim() ||
        !isValidEmail(row.email) ||
        (row.specialRole !== "committee" && row.specialRole !== "speaker")
    );
    if (drafts.length === 0) {
      setNotice({
        title: "Nothing to send",
        message: "Add invitees manually or import a file first.",
        variant: "info",
      });
      return;
    }
    if (invalid.length > 0) {
      setNotice({
        title: "Fix the send list first",
        message: `${invalid.length} row${invalid.length === 1 ? " has" : "s have"} missing or invalid first name, email, or role.`,
        variant: "error",
      });
      return;
    }

    const eventTitle = events.find((event) => event.id === eventId)?.title ?? "the selected event";
    requestConfirm({
      title: `Send ${drafts.length} exclusive invite${drafts.length === 1 ? "" : "s"}?`,
      message: `Create and email ${drafts.length} complimentary invite${drafts.length === 1 ? "" : "s"} for ${eventTitle}? Review the list carefully. This will send now.`,
      confirmLabel: "Send invites",
      loadingMessage: "Sending exclusive invites...",
      successTitle: "Invites processed",
      successMessage: "Invite creation finished.",
      showSuccess: false,
      action: async () => {
        const res = await fetch("/api/admin/invites/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            invites: drafts.map((row) => ({
              firstName: row.firstName.trim(),
              email: row.email.trim().toLowerCase(),
              specialRole: row.specialRole,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Could not send invites.");
        }

        const failedIndexes = new Set(
          ((data.results ?? []) as Array<{ index: number; ok: boolean; error?: string }>)
            .filter((row) => !row.ok)
            .map((row) => row.index)
        );
        const failedRows: DraftInvite[] = [];
        drafts.forEach((row, index) => {
          if (!failedIndexes.has(index)) return;
          const result = (data.results as Array<{ index: number; error?: string }>).find(
            (item) => item.index === index
          );
          failedRows.push({
            ...row,
            sendError: result?.error || "Could not create invite.",
          });
        });

        setDrafts(failedRows);
        await loadInvites();
        setNotice({
          title: failedRows.length > 0 ? "Some invites need attention" : "Invites sent",
          message: data.message || "Exclusive invites were processed.",
          variant: failedRows.length > 0 ? "info" : "success",
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

  const roleOptions = [
    { value: "", label: "Select role" },
    { value: "committee", label: "Committee" },
    { value: "speaker", label: "Guest Speaker" },
  ];

  return (
    <div className="admin-page admin-invites">
      <LoadingOverlay show={loading || importing} scope="local" variant="form" />
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

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display">Special Invites</h1>
          <p className="admin-muted">
            Prepare exclusive complimentary invites for Committee and Guest Speaker recipients, review
            the list, then send.
          </p>
        </div>

        <label className="admin-participants-search">
          <svg className="admin-participants-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
            <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            id="invite-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, role..."
            aria-label="Search special invites"
            disabled={loading}
          />
        </label>
      </div>

      <section className="admin-card mb-3">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title font-display mb-1">Prepare invites</h2>
            <p className="admin-muted mb-0">
              Add people one by one or import Excel/CSV/PDF. Nothing is emailed until you review and
              click Send.
            </p>
          </div>
          <a className="admin-link-btn" href="/api/admin/invites/template">
            Download Excel template
          </a>
        </div>

        <form className="admin-form p-3" onSubmit={addDraftFromForm}>
          <div className="row g-3">
            <div className="col-12 col-md-3">
              <label className="admin-label" htmlFor="invite-first-name">
                First name
              </label>
              <input
                id="invite-first-name"
                type="text"
                className="admin-input"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Maria"
                disabled={loading}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="admin-label" htmlFor="invite-email">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                className="admin-input"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="guest@example.com"
                disabled={loading}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="admin-label" htmlFor="invite-role">
                Role
              </label>
              <PnaSelect
                id="invite-role"
                className="admin-select"
                value={specialRole}
                onChange={(value) => setSpecialRole(value as SpecialRole | "")}
                options={roleOptions}
                placeholder="Select role"
                required
                disabled={loading}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="admin-label" htmlFor="invite-event">
                Event
              </label>
              <PnaSelect
                id="invite-event"
                className="admin-select"
                value={eventId}
                onChange={setEventId}
                options={eventOptions}
                placeholder="Select event"
                required
                disabled={loading}
              />
            </div>
            <div className="col-12 d-flex gap-2 flex-wrap">
              <button type="submit" className="admin-btn-primary" disabled={loading}>
                Add to send list
              </button>
              <label className="admin-link-btn mb-0" htmlFor={importInputId} style={{ cursor: "pointer" }}>
                Import Excel / CSV / PDF
              </label>
              <input
                id={importInputId}
                type="file"
                accept=".xlsx,.xlsm,.csv,.pdf,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                disabled={loading || importing}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  void handleImportFile(file);
                }}
              />
            </div>
          </div>
        </form>
      </section>

      {drafts.length > 0 ? (
        <section className="admin-card mb-3">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title font-display mb-1">
                Ready to send ({drafts.length})
              </h2>
              <p className="admin-muted mb-0">
                Review and correct any rows below. Invites are only created and emailed when you
                click Send invites.
              </p>
            </div>
            <div className="admin-invites-row-actions">
              <button
                type="button"
                className="admin-link-btn"
                onClick={() => setDrafts([])}
                disabled={loading}
              >
                Clear list
              </button>
              <button
                type="button"
                className="admin-btn-primary"
                onClick={requestSendDrafts}
                disabled={loading}
              >
                Send invites
              </button>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>First name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr key={draft.localId}>
                    <td>
                      <input
                        className="admin-input"
                        value={draft.firstName}
                        onChange={(e) => updateDraft(draft.localId, { firstName: e.target.value })}
                        aria-label={`First name for ${draft.email || "invitee"}`}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-input"
                        type="email"
                        value={draft.email}
                        onChange={(e) => updateDraft(draft.localId, { email: e.target.value })}
                        aria-label={`Email for ${draft.firstName || "invitee"}`}
                      />
                    </td>
                    <td>
                      <PnaSelect
                        className="admin-select"
                        value={draft.specialRole}
                        onChange={(value) =>
                          updateDraft(draft.localId, { specialRole: value as SpecialRole | "" })
                        }
                        options={roleOptions}
                        aria-label={`Role for ${draft.email || draft.firstName || "invitee"}`}
                      />
                      {draft.parseWarning ? (
                        <div className="admin-muted small mt-1">{draft.parseWarning}</div>
                      ) : null}
                      {draft.sendError ? (
                        <div className="text-danger small mt-1">{draft.sendError}</div>
                      ) : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-link-btn admin-link-btn--danger"
                        onClick={() => removeDraft(draft.localId)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="admin-participants-toolbar">
        <label className="admin-participants-filter">
          <span className="admin-label">Status</span>
          <PnaSelect
            id="invite-status-filter"
            className="admin-select"
            value={statusFilter}
            onChange={setStatusFilter}
            disabled={listLoading || loading}
            aria-label="Filter by invite status"
            options={[
              { value: "", label: "All statuses" },
              { value: "pending", label: "Awaiting signup" },
              { value: "used", label: "Signed up" },
              { value: "revoked", label: "Revoked" },
            ]}
          />
        </label>

        <label className="admin-participants-filter">
          <span className="admin-label">Event</span>
          <PnaSelect
            id="invite-event-filter"
            className="admin-select"
            value={eventFilter}
            onChange={setEventFilter}
            disabled={listLoading || loading}
            aria-label="Filter by event"
            options={[{ value: "", label: "All events" }, ...eventOptions.slice(1)]}
          />
        </label>
      </div>

      <div className="admin-card admin-table-wrap">
        {listLoading && invites.length === 0 ? (
          <TableSkeleton rows={6} columns={8} />
        ) : invites.length === 0 ? (
          <p className="admin-muted p-3 mb-0">
            No special invites found{searchQuery ? " matching your search" : ""}.
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Event</th>
                <th>Status</th>
                <th>Signed up</th>
                <th>Sent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.firstName || "—"}</td>
                  <td>
                    <div>{invite.email}</div>
                  </td>
                  <td>
                    {invite.specialRole
                      ? SPECIAL_ROLE_SHORT_LABELS[invite.specialRole]
                      : "—"}
                  </td>
                  <td>{invite.eventTitle}</td>
                  <td>{SPECIAL_INVITE_STATUS_LABELS[invite.status]}</td>
                  <td>
                    {invite.registration ? (
                      <div>
                        <div className="fw-semibold">
                          {invite.registration.firstName} {invite.registration.lastName}
                        </div>
                        <div className="admin-muted small">
                          {invite.registration.referenceNumber}
                          {invite.registration.specialRole
                            ? ` · ${SPECIAL_ROLE_LABELS[invite.registration.specialRole]}`
                            : ""}
                        </div>
                        <Link
                          href={`/admin/participants?eventId=${encodeURIComponent(invite.eventId)}&q=${encodeURIComponent(invite.registration.referenceNumber)}`}
                          className="small admin-link"
                        >
                          View participant
                        </Link>
                      </div>
                    ) : invite.status === "used" ? (
                      <span className="admin-muted small">Record missing</span>
                    ) : (
                      <span className="admin-muted small">Not yet</span>
                    )}
                  </td>
                  <td>{formatWhen(invite.sentAt)}</td>
                  <td>
                    <div className="admin-invites-row-actions">
                      {invite.status === "pending" ? (
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => void copyLink(invite)}
                          disabled={loading}
                        >
                          Copy link
                        </button>
                      ) : null}
                      {invite.status === "pending" || invite.status === "used" ? (
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => requestResend(invite)}
                          disabled={loading}
                        >
                          {invite.status === "used" ? "Resend confirmation" : "Resend invite"}
                        </button>
                      ) : null}
                      {invite.status === "pending" ? (
                        <button
                          type="button"
                          className="admin-link-btn admin-link-btn--danger"
                          onClick={() => requestRevoke(invite)}
                          disabled={loading}
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
        )}
      </div>
    </div>
  );
}
