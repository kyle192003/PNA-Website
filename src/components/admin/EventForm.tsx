"use client";

import { useEffect, useRef, useState } from "react";
import { conference } from "@/lib/conference";
import { formatDateRangeDisplay, formatLongDate, parseLooseDateToIso } from "@/lib/event-date";
import type { ConferenceEvent, EventFees, EventStatus } from "@/lib/types/admin";
import { getDefaultEventFees } from "@/lib/types/admin";
import { normalizeEventFees } from "@/lib/registration-fees";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { PnaSelect } from "@/components/ui/PnaSelect";
import { AdminDateInput, AdminDateRangeInput } from "@/components/admin/AdminDateFields";

interface EventFormProps {
  initial?: Partial<ConferenceEvent>;
  onSubmit: (
    data: Record<string, unknown>,
    options?: { qrFile?: File | null }
  ) => Promise<void>;
  submitLabel?: string;
  formId?: string;
  showBottomActions?: boolean;
  /** Show payment QR file picker (used on create). */
  showQrUpload?: boolean;
}

export function EventForm({
  initial,
  onSubmit,
  submitLabel = "Save Event",
  formId = "admin-event-form",
  showBottomActions = true,
  showQrUpload = false,
}: EventFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const qrFileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<EventStatus>(
    initial?.status ?? (initial?.isActive ? "open" : "draft")
  );
  const [featuredOnHomepage, setFeaturedOnHomepage] = useState(
    initial?.featuredOnHomepage ?? false
  );
  const [datesDisplay, setDatesDisplay] = useState(
    initial?.datesDisplay ?? ""
  );
  const [earlyBirdDeadline, setEarlyBirdDeadline] = useState(
    initial?.earlyBirdDeadline ?? conference.registration.earlyBirdDeadline
  );
  const [regularDeadline, setRegularDeadline] = useState(
    initial?.regularDeadline ?? conference.registration.regularDeadline
  );
  const [fees, setFees] = useState<EventFees>(() =>
    normalizeEventFees(initial?.fees ?? getDefaultEventFees())
  );
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [currentFeatured, setCurrentFeatured] = useState<{ id: string; title: string } | null>(
    null
  );
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;

  const isCreate = !initial?.id;
  const canFeature = status === "open" || status === "upcoming";
  const replacesFeatured =
    featuredOnHomepage &&
    currentFeatured !== null &&
    currentFeatured.id !== initial?.id;

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/events")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setCurrentFeatured(data.featuredHomepageEvent ?? null);
      })
      .catch(() => {
        if (!cancelled) setCurrentFeatured(null);
      });

    return () => {
      cancelled = true;
    };
  }, [initial?.id]);

  useEffect(() => {
    if (initial?.status) {
      setStatus(initial.status);
    }
    setFeaturedOnHomepage(initial?.featuredOnHomepage ?? false);
    setDatesDisplay(initial?.datesDisplay ?? (isCreate ? "" : conference.dates.display));
    setEarlyBirdDeadline(
      initial?.earlyBirdDeadline ?? conference.registration.earlyBirdDeadline
    );
    setRegularDeadline(initial?.regularDeadline ?? conference.registration.regularDeadline);
    setFees(normalizeEventFees(initial?.fees ?? getDefaultEventFees()));
  }, [
    initial?.id,
    initial?.status,
    initial?.featuredOnHomepage,
    initial?.datesDisplay,
    initial?.earlyBirdDeadline,
    initial?.regularDeadline,
    initial?.fees,
    isCreate,
  ]);

  useEffect(() => {
    if (!canFeature && featuredOnHomepage) {
      setFeaturedOnHomepage(false);
    }
  }, [canFeature, featuredOnHomepage]);

  useEffect(() => {
    return () => {
      if (qrPreviewUrl) URL.revokeObjectURL(qrPreviewUrl);
    };
  }, [qrPreviewUrl]);

  function handleQrFileChange(file: File | null) {
    setQrPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  function buildPayload(form: HTMLFormElement) {
    const formData = new FormData(form);
    const nextStatus = formData.get("status") as EventStatus;
    const windowEnd =
      fees.earlyBird.windowEnd?.trim() ||
      parseLooseDateToIso(earlyBirdDeadline) ||
      undefined;
    const cap = fees.earlyBird.cap ?? 500;
    const earlyAmount = fees.earlyBird.amount;
    const nextFees = {
      ...fees,
      earlyBird: {
        ...fees.earlyBird,
        mode: "slots" as const,
        cap,
        windowStart: fees.earlyBird.windowStart,
        windowEnd,
        caption:
          fees.earlyBird.windowStart && windowEnd
            ? `First ${cap} registrants within ${formatDateRangeDisplay(
                fees.earlyBird.windowStart,
                windowEnd
              )} (whichever ends first)`
            : windowEnd
              ? `First ${cap} registrants, or until ${formatLongDate(windowEnd)} (whichever comes first)`
              : `First ${cap} registrants only`,
      },
      seniorPwd: {
        ...fees.seniorPwd,
        amount: earlyAmount,
        caption: "Valid Senior Citizen or PWD ID required",
      },
      regular: {
        ...fees.regular,
        caption: "Applies after early bird slots fill or the early bird period ends",
      },
      nonMember: {
        ...fees.nonMember,
        caption:
          fees.nonMember.caption ??
          "Fixed rate for non-members (not eligible for early bird, Senior/PWD, or regular)",
      },
    };

    return {
      title: formData.get("title"),
      theme: formData.get("theme"),
      description: formData.get("description"),
      datesDisplay,
      venueName: formData.get("venueName"),
      venueAddress: formData.get("venueAddress"),
      venueMapsUrl: String(formData.get("venueMapsUrl") ?? "").trim() || null,
      earlyBirdDeadline: windowEnd ? formatLongDate(windowEnd) : earlyBirdDeadline,
      regularDeadline,
      status: nextStatus,
      featuredOnHomepage:
        (nextStatus === "open" || nextStatus === "upcoming") && featuredOnHomepage,
      showQrInRegistration: formData.get("showQrInRegistration") === "on",
      fees: nextFees,
    };
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const form = e.currentTarget;
    if (!datesDisplay.trim()) {
      setError("Please select the event start and end dates.");
      return;
    }

    const windowStart = fees.earlyBird.windowStart?.trim() ?? "";
    const windowEnd =
      fees.earlyBird.windowEnd?.trim() || parseLooseDateToIso(earlyBirdDeadline) || "";
    if (!windowEnd) {
      setError("Please set the early bird end date (and optionally a start date).");
      return;
    }
    if (windowStart && windowEnd < windowStart) {
      setError("Early bird window end must be on or after the start date.");
      return;
    }

    const payload = buildPayload(form);
    const qrFile = showQrUpload ? qrFileInputRef.current?.files?.[0] ?? null : null;
    const featureMessage = replacesFeatured
      ? `"${currentFeatured?.title}" is currently featured on the homepage. This event will replace it as the only highlighted event.`
      : featuredOnHomepage
        ? "This event will be the only highlighted event on the homepage."
        : undefined;

    requestConfirm({
      title: isCreate ? "Create this event?" : "Save event changes?",
      message: featureMessage
        ? `${isCreate ? "Are you sure you want to create this event?" : "Are you sure you want to save changes to this event?"} ${featureMessage}`
        : isCreate
          ? "Are you sure you want to create this event?"
          : "Are you sure you want to save changes to this event?",
      confirmLabel: isCreate ? "Create event" : "Save changes",
      loadingMessage: isCreate ? "Creating event..." : "Saving event...",
      successTitle: isCreate ? "Event created" : "Event updated",
      successMessage: replacesFeatured
        ? "Homepage highlight updated. Only this event is featured now."
        : isCreate
          ? "The event was created successfully."
          : "Your event changes were saved successfully.",
      action: async () => {
        try {
          await onSubmit(payload, { qrFile });
          const res = await fetch("/api/admin/events");
          const data = await res.json();
          setCurrentFeatured(data.featuredHomepageEvent ?? null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to save event.");
          throw err;
        }
      },
    });
  }

  return (
    <div className="admin-form-wrap">
      <LoadingOverlay show={loading} scope="local" variant="form" />
      <ActionConfirmDialogs hook={confirmHook} />

      <form ref={formRef} id={formId} onSubmit={handleSubmit} className="admin-form">
        {error && <div className="admin-alert admin-alert--error">{error}</div>}

        <div className="row g-3">
          <div className="col-12">
            <label className="admin-label" htmlFor="title">
              Event Title
            </label>
            <input
              id="title"
              name="title"
              className="admin-input"
              defaultValue={initial?.title ?? conference.conferenceName}
              required
              disabled={loading}
            />
          </div>

          <div className="col-12">
            <label className="admin-label" htmlFor="theme">
              Theme
            </label>
            <input
              id="theme"
              name="theme"
              className="admin-input"
              defaultValue={initial?.theme ?? conference.theme}
              disabled={loading}
            />
          </div>

          <div className="col-12">
            <label className="admin-label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              className="admin-input"
              rows={3}
              defaultValue={initial?.description ?? conference.hero.description}
              disabled={loading}
            />
          </div>

          <div className="col-md-6">
            <AdminDateRangeInput
              id="datesDisplay"
              name="datesDisplay"
              label="Event Dates"
              value={datesDisplay}
              onChange={setDatesDisplay}
              required
              disabled={loading}
              disallowPastStart={isCreate}
              helpText={
                isCreate
                  ? "Click a start date, then an end date. Past dates are disabled."
                  : "Click a start date, then an end date. Same-day events are allowed."
              }
            />
          </div>

          <div className="col-md-6">
            <label className="admin-label" htmlFor="venueName">
              Venue
            </label>
            <input
              id="venueName"
              name="venueName"
              className="admin-input"
              defaultValue={initial?.venueName ?? conference.venue.name}
              disabled={loading}
            />
          </div>

          <div className="col-12">
            <label className="admin-label" htmlFor="venueAddress">
              Venue Address
            </label>
            <input
              id="venueAddress"
              name="venueAddress"
              className="admin-input"
              defaultValue={initial?.venueAddress ?? conference.venue.address}
              disabled={loading}
            />
          </div>

          <div className="col-12">
            <label className="admin-label" htmlFor="venueMapsUrl">
              Google Maps link <span className="admin-muted">(optional)</span>
            </label>
            <input
              id="venueMapsUrl"
              name="venueMapsUrl"
              type="url"
              className="admin-input"
              placeholder="https://maps.google.com/..."
              defaultValue={initial?.venueMapsUrl ?? ""}
              disabled={loading}
            />
            <p className="admin-field-help">
              Paste a Google Maps share link for a precise pin. If left blank, participants still get
              a Maps search from the venue name and address.
            </p>
          </div>

          <div className="col-12">
            <p className="admin-label mb-2">Early bird rules</p>
            <p className="admin-field-help mb-3">
              Early bird applies to the first N registrants <strong>and</strong> only while the date
              window is open. If the window ends with unused slots, pricing still switches to
              regular. Senior Citizen/PWD is hidden during early bird and shown after it ends.
            </p>
          </div>

          <div className="col-md-6">
            <AdminDateInput
              id="earlyBirdWindowStart"
              name="earlyBirdWindowStart"
              label="Early Bird Window Start"
              value={
                fees.earlyBird.windowStart ? formatLongDate(fees.earlyBird.windowStart) : ""
              }
              onChange={(display) => {
                const iso = parseLooseDateToIso(display) ?? "";
                setFees((prev) => ({
                  ...prev,
                  earlyBird: { ...prev.earlyBird, windowStart: iso || undefined },
                }));
              }}
              disabled={loading}
              helpText="Optional. Leave blank to open early bird immediately."
            />
          </div>
          <div className="col-md-6">
            <AdminDateInput
              id="earlyBirdWindowEnd"
              name="earlyBirdWindowEnd"
              label="Early Bird Window End"
              value={
                fees.earlyBird.windowEnd
                  ? formatLongDate(fees.earlyBird.windowEnd)
                  : earlyBirdDeadline
              }
              onChange={(display) => {
                const iso = parseLooseDateToIso(display) ?? "";
                setFees((prev) => ({
                  ...prev,
                  earlyBird: { ...prev.earlyBird, windowEnd: iso || undefined },
                }));
                if (display.trim()) setEarlyBirdDeadline(display);
              }}
              disabled={loading}
              required
              min={fees.earlyBird.windowStart}
              helpText="Required. Early bird closes on this date even if slots remain."
            />
          </div>

          <div className="col-md-6">
            <AdminDateInput
              id="regularDeadline"
              name="regularDeadline"
              label="Regular Deadline"
              value={regularDeadline}
              onChange={setRegularDeadline}
              disabled={loading}
            />
          </div>

          <div className="col-12">
            <p className="admin-label mb-2">Registration fees (editable per event)</p>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="admin-label" htmlFor="feeEarlyBird">
                  Early Bird amount (₱)
                </label>
                <input
                  id="feeEarlyBird"
                  type="number"
                  min={0}
                  step={1}
                  className="admin-input"
                  value={fees.earlyBird.amount}
                  onChange={(e) => {
                    const amount = Number(e.target.value) || 0;
                    setFees((prev) => ({
                      ...prev,
                      earlyBird: { ...prev.earlyBird, amount },
                      seniorPwd: { ...prev.seniorPwd, amount },
                    }));
                  }}
                  disabled={loading}
                />
                <label className="admin-label mt-2" htmlFor="feeEarlyBirdCap">
                  Early Bird cap (first N)
                </label>
                <input
                  id="feeEarlyBirdCap"
                  type="number"
                  min={1}
                  step={1}
                  className="admin-input"
                  value={fees.earlyBird.cap ?? 500}
                  onChange={(e) =>
                    setFees((prev) => ({
                      ...prev,
                      earlyBird: {
                        ...prev.earlyBird,
                        cap: Number(e.target.value) || 500,
                      },
                    }))
                  }
                  disabled={loading}
                />
              </div>
              <div className="col-md-4">
                <label className="admin-label" htmlFor="feeRegular">
                  Regular amount (₱)
                </label>
                <input
                  id="feeRegular"
                  type="number"
                  min={0}
                  step={1}
                  className="admin-input"
                  value={fees.regular.amount}
                  onChange={(e) =>
                    setFees((prev) => ({
                      ...prev,
                      regular: {
                        ...prev.regular,
                        amount: Number(e.target.value) || 0,
                      },
                    }))
                  }
                  disabled={loading}
                />
              </div>
              <div className="col-md-4">
                <label className="admin-label" htmlFor="feeSenior">
                  Senior Citizen/PWD amount (₱)
                </label>
                <input
                  id="feeSenior"
                  type="number"
                  min={0}
                  step={1}
                  className="admin-input"
                  value={fees.earlyBird.amount}
                  readOnly
                  disabled={loading}
                />
                <p className="admin-field-help mt-2 mb-0">
                  Shown only after early bird ends.
                </p>
              </div>
              <div className="col-md-4">
                <label className="admin-label" htmlFor="feeNonMember">
                  Non-Member amount (₱)
                </label>
                <input
                  id="feeNonMember"
                  type="number"
                  min={0}
                  step={1}
                  className="admin-input"
                  value={fees.nonMember.amount}
                  onChange={(e) =>
                    setFees((prev) => ({
                      ...prev,
                      nonMember: {
                        ...prev.nonMember,
                        amount: Number(e.target.value) || 0,
                      },
                    }))
                  }
                  disabled={loading}
                />
                <p className="admin-field-help mt-2 mb-0">
                  Fixed rate for non-members only. Early bird, Senior/PWD, and regular rates do not
                  apply.
                </p>
              </div>
            </div>
            <p className="admin-field-help">
              Defaults come from the site schedule. Changing these only affects this event.
            </p>
          </div>

          <div className="col-md-6">
            <label className="admin-label" htmlFor="status">
              Event Status
            </label>
            <PnaSelect
              id="status"
              name="status"
              className="admin-select"
              value={status}
              onChange={(next) => setStatus(next as EventStatus)}
              disabled={loading}
              options={[
                { value: "draft", label: "Draft (hidden from public)" },
                { value: "upcoming", label: "Upcoming Soon (visible, registration closed)" },
                { value: "open", label: "Open for Registration" },
                { value: "finished", label: "Finished (sends evaluation invites)" },
              ]}
            />
            <p className="admin-field-help">
              Use Upcoming Soon when details are not finalized. Mark Finished when the event is over
              to send evaluation forms to checked-in participants.
            </p>
          </div>

          <div className="col-md-6">
            <label className="admin-check">
              <input
                type="checkbox"
                name="featuredOnHomepage"
                checked={featuredOnHomepage}
                onChange={(e) => setFeaturedOnHomepage(e.target.checked)}
                disabled={loading || !canFeature}
              />
              Feature as main event on homepage
            </label>
            <p className="admin-field-help">
              Only one event can be featured at a time. Draft events cannot be featured.
              {currentFeatured && currentFeatured.id !== initial?.id && (
                <>
                  {" "}
                  Currently featured: <strong>{currentFeatured.title}</strong>.
                  {featuredOnHomepage
                    ? " Saving will move the highlight to this event."
                    : " Check this box to replace it."}
                </>
              )}
              {currentFeatured && currentFeatured.id === initial?.id && featuredOnHomepage && (
                <> This event is currently the homepage highlight.</>
              )}
            </p>
          </div>

          <div className="col-md-6">
            <label className="admin-check">
              <input
                type="checkbox"
                name="showQrInRegistration"
                defaultChecked={initial?.showQrInRegistration ?? true}
                disabled={loading}
              />
              Show QR code in registration form
            </label>
          </div>

          {showQrUpload ? (
            <div className="col-12">
              <div className="admin-qr-create-panel">
                <p className="admin-qr-create-title">Payment QR Code</p>
                <p className="admin-field-help mb-0">
                  Optional. Upload the payment QR now, or add it later from the event page.
                </p>
                {qrPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrPreviewUrl}
                    alt="Payment QR preview"
                    className="admin-qr-create-preview"
                  />
                ) : null}
                <input
                  ref={qrFileInputRef}
                  type="file"
                  name="qrFile"
                  accept="image/*"
                  className="admin-input"
                  disabled={loading}
                  onChange={(e) => handleQrFileChange(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          ) : null}
        </div>

        {showBottomActions && (
          <div className="admin-form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Please wait..." : submitLabel}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
