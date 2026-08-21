"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatLongDate, todayIsoInTimeZone } from "@/lib/event-date";
import { getEmailValidationError } from "@/lib/form-validation";
import { SuccessDialog } from "@/components/ui/MessageDialog";

const WEEKDAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type ShareState = {
  url: string | null;
  status: "active" | "expired" | null;
  expiresAt: string | null;
  notifyEmails: string[];
  expiryDays: number;
  weeklySend: {
    enabled: boolean;
    dayOfWeek: number;
    hour: number;
    lastSentAt: string | null;
  };
};

function toIsoFromParts(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function addDaysIso(iso: string, days: number): string {
  const parsed = parseIso(iso);
  if (!parsed) return iso;
  const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d + days, 12));
  return toIsoFromParts(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = parseIso(fromIso);
  const to = parseIso(toIso);
  if (!from || !to) return 1;
  const a = Date.UTC(from.y, from.m - 1, from.d);
  const b = Date.UTC(to.y, to.m - 1, to.d);
  return Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

function isoFromExpiresAt(expiresAt: string | null | undefined, fallbackDays: number): string {
  const today = todayIsoInTimeZone();
  if (expiresAt) {
    const manila = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(expiresAt));
    if (manila >= today) return manila;
  }
  return addDaysIso(today, fallbackDays || 5);
}

function buildMonthCells(year: number, monthIndex: number) {
  const firstDow = new Date(Date.UTC(year, monthIndex, 1, 12)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
  const cells: Array<{ iso: string; day: number; inMonth: true } | { inMonth: false }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ inMonth: false });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ inMonth: true, day, iso: toIsoFromParts(year, monthIndex, day) });
  }
  while (cells.length % 7 !== 0) cells.push({ inMonth: false });
  return cells;
}

function monthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1, 12)));
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AccountantSharePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sendSuccessOpen, setSendSuccessOpen] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [expiryDate, setExpiryDate] = useState(() => addDaysIso(todayIsoInTimeZone(), 5));
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [weeklyDay, setWeeklyDay] = useState(1);
  const [weeklyHour, setWeeklyHour] = useState(9);
  const [share, setShare] = useState<ShareState | null>(null);
  const [viewYear, setViewYear] = useState(() => {
    const today = parseIso(todayIsoInTimeZone());
    return today?.y ?? new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const today = parseIso(todayIsoInTimeZone());
    return today ? today.m - 1 : new Date().getMonth();
  });

  const today = todayIsoInTimeZone();
  const maxDate = addDaysIso(today, 30);
  const expiryDays = daysBetween(today, expiryDate);

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setEmailDraft("");

    void (async () => {
      try {
        const res = await fetch("/api/admin/accountant-share");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load accounting settings.");
        if (cancelled) return;

        setShare(data as ShareState);
        const loadedEmails = Array.isArray(data.notifyEmails)
          ? data.notifyEmails
          : data.notifyEmail
            ? [data.notifyEmail]
            : [];
        setEmails(loadedEmails);
        const nextExpiry = isoFromExpiresAt(
          data.expiresAt,
          typeof data.expiryDays === "number" ? data.expiryDays : 5
        );
        setExpiryDate(nextExpiry);
        const parsed = parseIso(nextExpiry);
        if (parsed) {
          setViewYear(parsed.y);
          setViewMonth(parsed.m - 1);
        }
        setWeeklyEnabled(Boolean(data.weeklySend?.enabled));
        setWeeklyDay(typeof data.weeklySend?.dayOfWeek === "number" ? data.weeklySend.dayOfWeek : 1);
        setWeeklyHour(typeof data.weeklySend?.hour === "number" ? data.weeklySend.hour : 9);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load accounting settings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  function settingsPayload() {
    return {
      notifyEmails: emails,
      expiryDays,
      expiresAt: expiryDate,
      weeklySend: {
        enabled: weeklyEnabled,
        dayOfWeek: weeklyDay,
        hour: weeklyHour,
      },
    };
  }

  function addEmail() {
    const next = emailDraft.trim().toLowerCase();
    if (!next) return;
    const validation = getEmailValidationError(next, "Accounting email");
    if (validation) {
      setError(validation);
      return;
    }
    if (emails.includes(next)) {
      setError("That email is already added.");
      return;
    }
    setError(null);
    setEmails((current) => [...current, next]);
    setEmailDraft("");
  }

  function removeEmail(email: string) {
    setEmails((current) => current.filter((item) => item !== email));
  }

  async function saveSettings() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      // PATCH only — never emails accounting.
      const res = await fetch("/api/admin/accountant-share", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save settings.");
      setShare(data as ShareState);
      setSuccess("Settings saved. No email was sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function sendToAccounting() {
    if (!emails.length) {
      setError("Add at least one accounting email before sending.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/accountant-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          sendEmail: true,
          // Reuse the active link until the admin-set expiry. Only mint a new URL if expired.
          createNewLink: false,
          ...settingsPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not email the accounting link.");
      setShare(data as ShareState);
      const recipients = Array.isArray(data.notifyEmails)
        ? data.notifyEmails.join(", ")
        : emails.join(", ");
      setSendSuccessMessage(
        `The pending-payments review link was emailed to ${recipients}. The email includes the expiry date (${formatLongDate(expiryDate)}).`
      );
      onClose();
      setSendSuccessOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not email the accounting link.");
    } finally {
      setBusy(false);
    }
  }

  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(viewYear, viewMonth + delta, 1, 12));
    setViewYear(date.getUTCFullYear());
    setViewMonth(date.getUTCMonth());
  }

  if (!mounted) return null;

  return (
    <>
      <SuccessDialog
        open={sendSuccessOpen}
        title="Email sent"
        message={sendSuccessMessage}
        onClose={() => setSendSuccessOpen(false)}
      />
      {open
        ? createPortal(
    <div className="admin-accountant-modal" role="presentation">
      <button
        type="button"
        className="admin-accountant-modal-backdrop"
        onClick={() => {
          if (!busy) onClose();
        }}
        aria-label="Close accounting link settings"
      />
      <div
        className="admin-accountant-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-accountant-modal-title"
      >
        <div className="admin-accountant-modal-header">
          <div>
            <h2 id="admin-accountant-modal-title" className="admin-card-title font-display">
              Send to accounting
            </h2>
            <p className="admin-muted mb-0">
              Add the accounting email, pick when the link expires, and choose the weekly send day.
            </p>
          </div>
          <button
            type="button"
            className="admin-accountant-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p className="admin-muted">Loading settings…</p>
        ) : (
          <div className="admin-accountant-modal-body">
            {error ? <div className="admin-alert admin-alert--error">{error}</div> : null}
            {success ? <div className="admin-alert admin-alert--success">{success}</div> : null}

            <section className="admin-accountant-section">
              <h3 className="admin-accountant-section-title">1. Accounting email</h3>
              <p className="admin-field-help">
                Add the email address that should receive the pending-payments link (for example
                accounting@yourorg.com).
              </p>
              <div className="admin-accountant-email-row">
                <input
                  id="accountant-email-draft"
                  className="admin-input"
                  type="email"
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addEmail();
                    }
                  }}
                  placeholder="accounting@example.com"
                  disabled={busy}
                  aria-label="Accounting email to add"
                />
                <button
                  type="button"
                  className="admin-link-btn"
                  onClick={addEmail}
                  disabled={busy || !emailDraft.trim()}
                >
                  Add email
                </button>
              </div>
              {emails.length ? (
                <ul className="admin-accountant-email-chips">
                  {emails.map((email) => (
                    <li key={email}>
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        disabled={busy}
                        aria-label={`Remove ${email}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-accountant-empty">No accounting email added yet.</p>
              )}
            </section>

            <section className="admin-accountant-section">
              <h3 className="admin-accountant-section-title">2. Link expiry date</h3>
              <p className="admin-field-help">
                Tap a date on the calendar. The review link will stop working after that day.
              </p>
              <div className="admin-accountant-calendar">
                <div className="admin-accountant-calendar-nav">
                  <button
                    type="button"
                    className="admin-accountant-calendar-nav-btn"
                    onClick={() => shiftMonth(-1)}
                    disabled={busy}
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <p className="admin-accountant-calendar-month">{monthLabel(viewYear, viewMonth)}</p>
                  <button
                    type="button"
                    className="admin-accountant-calendar-nav-btn"
                    onClick={() => shiftMonth(1)}
                    disabled={busy}
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>
                <div className="admin-accountant-calendar-weekdays" aria-hidden="true">
                  {WEEKDAY_SHORT.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="admin-accountant-calendar-grid">
                  {cells.map((cell, index) =>
                    cell.inMonth ? (
                      <button
                        key={cell.iso}
                        type="button"
                        className={`admin-accountant-calendar-day${
                          cell.iso === expiryDate ? " is-selected" : ""
                        }${cell.iso === today ? " is-today" : ""}`}
                        disabled={busy || cell.iso < today || cell.iso > maxDate}
                        onClick={() => setExpiryDate(cell.iso)}
                      >
                        {cell.day}
                      </button>
                    ) : (
                      <span key={`empty-${index}`} className="admin-accountant-calendar-empty" />
                    )
                  )}
                </div>
              </div>
              <p className="admin-accountant-summary">
                Link expires on <strong>{formatLongDate(expiryDate)}</strong> ({expiryDays} day
                {expiryDays === 1 ? "" : "s"} from today, Asia/Manila).
              </p>
            </section>

            <section className="admin-accountant-section">
              <h3 className="admin-accountant-section-title">3. Automatic weekly send</h3>
              <label className="admin-accountant-check">
                <input
                  type="checkbox"
                  checked={weeklyEnabled}
                  onChange={(event) => setWeeklyEnabled(event.target.checked)}
                  disabled={busy}
                />
                <span>Email the accounting link automatically every week</span>
              </label>
              <p className="admin-field-help">
                Choose which weekday it should send. Schedule uses Asia/Manila time.
              </p>
              <div className="admin-accountant-weekday-row" role="listbox" aria-label="Weekly send day">
                {WEEKDAY_FULL.map((label, value) => (
                  <button
                    key={label}
                    type="button"
                    role="option"
                    aria-selected={weeklyDay === value}
                    className={`admin-accountant-weekday${weeklyDay === value ? " is-selected" : ""}`}
                    disabled={busy || !weeklyEnabled}
                    onClick={() => {
                      setWeeklyEnabled(true);
                      setWeeklyDay(value);
                    }}
                  >
                    <span className="admin-accountant-weekday-short">{WEEKDAY_SHORT[value]}</span>
                    <span className="admin-accountant-weekday-full">{label}</span>
                  </button>
                ))}
              </div>
              <label className="admin-label" htmlFor="accountant-weekly-hour">
                Send at (Asia/Manila)
              </label>
              <select
                id="accountant-weekly-hour"
                className="admin-input admin-accountant-hour"
                value={weeklyHour}
                onChange={(event) => setWeeklyHour(Number(event.target.value))}
                disabled={busy || !weeklyEnabled}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {String(hour).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
              <p className="admin-accountant-summary">
                {weeklyEnabled ? (
                  <>
                    Will send every <strong>{WEEKDAY_FULL[weeklyDay]}</strong> at{" "}
                    <strong>{String(weeklyHour).padStart(2, "0")}:00</strong> (Asia/Manila).
                  </>
                ) : (
                  <>Weekly automatic send is off. Turn it on and pick a day above.</>
                )}
              </p>
            </section>

            {share ? (
              <div className="admin-accountant-status">
                <p className="mb-0">
                  <strong>Current link:</strong>{" "}
                  {share.status === "active" && share.url
                    ? "Active"
                    : share.status === "expired"
                      ? "Expired"
                      : "Not created yet"}
                </p>
                <p className="admin-muted mb-0">
                  Expires: {formatExpiry(share.expiresAt)}
                  {share.weeklySend.lastSentAt
                    ? ` · Last weekly send: ${formatExpiry(share.weeklySend.lastSentAt)}`
                    : ""}
                </p>
              </div>
            ) : null}

            <div className="admin-accountant-send-preview">
              <p className="admin-accountant-summary mb-0">
                When you send now, accounting will receive the review link and a clear note that it
                expires on <strong>{formatLongDate(expiryDate)}</strong> (end of day, Asia/Manila).
                {emails.length ? (
                  <>
                    {" "}
                    Recipients: <strong>{emails.join(", ")}</strong>.
                  </>
                ) : (
                  <> Add at least one accounting email above first.</>
                )}
              </p>
            </div>

            <div className="admin-accountant-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void sendToAccounting()}
                disabled={busy || !emails.length}
              >
                {busy ? "Sending…" : "Send email to accounting now"}
              </button>
              <button
                type="button"
                className="admin-link-btn"
                onClick={() => void saveSettings()}
                disabled={busy}
              >
                Save settings only
              </button>
            </div>
            <p className="admin-field-help mb-0">
              Save settings only updates emails, expiry, and weekly schedule. It does not send an
              email.
            </p>
          </div>
        )}
      </div>
    </div>,
            document.body
          )
        : null}
    </>
  );
}
