"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatDateRangeDisplay,
  formatLongDate,
  parseEventEndDate,
  parseEventStartDate,
  parseLooseDateToIso,
  todayIsoInTimeZone,
} from "@/lib/event-date";

type AdminDateInputProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (displayValue: string) => void;
  disabled?: boolean;
  required?: boolean;
  helpText?: string;
  /** Minimum selectable date (YYYY-MM-DD). */
  min?: string;
};

/** Single-date field with native calendar; stores long display text for compatibility. */
export function AdminDateInput({
  id,
  name,
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  helpText,
  min,
}: AdminDateInputProps) {
  const isoValue = parseLooseDateToIso(value) ?? "";

  return (
    <div className="admin-date-field">
      <label className="admin-label" htmlFor={id}>
        {label}
      </label>
      <div className="admin-date-control">
        <input
          id={id}
          type="date"
          className="admin-input admin-date-input"
          value={isoValue}
          min={min}
          required={required}
          disabled={disabled}
          onChange={(event) => {
            const nextIso = event.target.value;
            onChange(nextIso ? formatLongDate(nextIso) : "");
          }}
        />
        <input type="hidden" name={name} value={value} />
      </div>
      {helpText ? <p className="admin-field-help">{helpText}</p> : null}
    </div>
  );
}

type AdminDateRangeInputProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (displayValue: string) => void;
  disabled?: boolean;
  required?: boolean;
  helpText?: string;
  /** When true, start date cannot be before today (Asia/Manila). */
  disallowPastStart?: boolean;
};

type SelectPhase = "start" | "end";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const DROPDOWN_ANIMATION_MS = 160;

function toIsoFromParts(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function monthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1, 12)));
}

function buildMonthCells(year: number, monthIndex: number) {
  const firstDow = new Date(Date.UTC(year, monthIndex, 1, 12)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
  const cells: Array<{ iso: string; day: number; inMonth: true } | { inMonth: false }> = [];

  for (let i = 0; i < firstDow; i++) {
    cells.push({ inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ inMonth: true, day, iso: toIsoFromParts(year, monthIndex, day) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ inMonth: false });
  }
  return cells;
}

function displayFromRange(start: string, end: string): string {
  if (!start && !end) return "";
  if (!start) return formatLongDate(end);
  if (!end || end === start) return formatLongDate(start);
  return formatDateRangeDisplay(start, end);
}

/** Compact trigger + Airbnb-style range calendar dropdown. */
export function AdminDateRangeInput({
  id,
  name,
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  helpText,
  disallowPastStart = false,
}: AdminDateRangeInputProps) {
  const todayIso = todayIsoInTimeZone();
  const minIso = disallowPastStart ? todayIso : undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const initialStart = parseEventStartDate(value) ?? "";
  const initialEnd = parseEventEndDate(value) ?? initialStart;

  const [startIso, setStartIso] = useState(initialStart);
  const [endIso, setEndIso] = useState(initialEnd);
  const [phase, setPhase] = useState<SelectPhase>("start");
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const lastEmittedRef = useRef(value);

  const focus = parseIso(initialStart || initialEnd || todayIso) ?? {
    y: Number(todayIso.slice(0, 4)),
    m: Number(todayIso.slice(5, 7)),
  };
  const [viewYear, setViewYear] = useState(focus.y);
  const [viewMonth, setViewMonth] = useState(focus.m - 1);

  useEffect(() => {
    if (value === lastEmittedRef.current) return;

    lastEmittedRef.current = value;
    const nextStart = parseEventStartDate(value) ?? "";
    const nextEnd = parseEventEndDate(value) ?? nextStart;
    setStartIso(nextStart);
    setEndIso(nextEnd);
    setPhase("start");
    setHoverIso(null);

    const nextFocus = parseIso(nextStart || nextEnd);
    if (nextFocus) {
      setViewYear(nextFocus.y);
      setViewMonth(nextFocus.m - 1);
    }
  }, [value]);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timeout = window.setTimeout(() => setRendered(false), DROPDOWN_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const cells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const previewEnd =
    phase === "end" && startIso && hoverIso && hoverIso >= startIso ? hoverIso : null;
  const rangeEnd = endIso || previewEnd || "";

  function emit(nextStart: string, nextEnd: string) {
    const display = displayFromRange(nextStart, nextEnd);
    lastEmittedRef.current = display;
    onChange(display);
  }

  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(viewYear, viewMonth + delta, 1, 12));
    setViewYear(date.getUTCFullYear());
    setViewMonth(date.getUTCMonth());
  }

  function openCalendar() {
    if (disabled) return;
    const focusDate = parseIso(startIso || endIso || todayIso);
    if (focusDate) {
      setViewYear(focusDate.y);
      setViewMonth(focusDate.m - 1);
    }
    if (!startIso || (startIso && endIso)) {
      setPhase("start");
    } else {
      setPhase("end");
    }
    setOpen(true);
  }

  function handleDayClick(iso: string) {
    if (disabled) return;
    if (minIso && iso < minIso) return;

    if (phase === "start" || (startIso && endIso) || !startIso) {
      setStartIso(iso);
      setEndIso("");
      setPhase("end");
      setHoverIso(null);
      emit(iso, "");
      return;
    }

    if (iso < startIso) {
      setStartIso(iso);
      setEndIso("");
      setPhase("end");
      setHoverIso(null);
      emit(iso, "");
      return;
    }

    setStartIso(startIso);
    setEndIso(iso);
    setPhase("start");
    setHoverIso(null);
    emit(startIso, iso);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function clearSelection(event?: React.MouseEvent) {
    event?.stopPropagation();
    if (disabled) return;
    setStartIso("");
    setEndIso("");
    setPhase("start");
    setHoverIso(null);
    emit("", "");
  }

  function dayState(iso: string) {
    const isDisabledDay = Boolean(minIso && iso < minIso);
    const isToday = iso === todayIso;
    const isStart = Boolean(startIso && iso === startIso);
    const isEnd = Boolean(rangeEnd && iso === rangeEnd);
    const inRange = Boolean(startIso && rangeEnd && iso > startIso && iso < rangeEnd);
    const isPreview = Boolean(previewEnd && !endIso && iso === previewEnd);

    return { isDisabledDay, isToday, isStart, isEnd, inRange, isPreview };
  }

  const triggerText =
    startIso && endIso
      ? formatDateRangeDisplay(startIso, endIso)
      : startIso
        ? `${formatLongDate(startIso)} — select end`
        : "Select event dates";

  const startLabel = startIso ? formatLongDate(startIso) : "Add date";
  const endLabel = endIso ? formatLongDate(endIso) : "Add date";

  return (
    <div className="admin-date-field" ref={rootRef}>
      <label className="admin-label" htmlFor={id}>
        {label}
        {required ? <span className="admin-required"> *</span> : null}
      </label>

      <div className={`admin-range-dropdown${open ? " is-open" : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          className={`admin-range-dropdown-trigger${value ? " has-value" : ""}${
            open ? " is-open" : ""
          }`}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => (open ? setOpen(false) : openCalendar())}
        >
          <span className="admin-range-dropdown-trigger-icon" aria-hidden="true">
            <CalendarIcon />
          </span>
          <span className="admin-range-dropdown-trigger-text">{triggerText}</span>
          <span className="admin-range-dropdown-trigger-caret" aria-hidden="true">
            <CaretIcon open={open} />
          </span>
        </button>

        {value && !disabled ? (
          <button
            type="button"
            className="admin-range-dropdown-clear-btn"
            onClick={clearSelection}
            aria-label="Clear dates"
          >
            Clear
          </button>
        ) : null}

        {rendered ? (
          <div
            id={`${id}-panel`}
            className={`admin-range-calendar admin-range-calendar--dropdown${
              visible ? " is-visible" : ""
            }${phase === "end" ? " is-picking-end" : ""}`}
            role="dialog"
            aria-label={label}
          >
            <div className="admin-range-calendar-pills" role="presentation">
              <div
                className={`admin-range-calendar-pill${
                  phase === "start" || !startIso ? " is-active" : ""
                }${startIso ? " has-value" : ""}`}
              >
                <span className="admin-range-calendar-pill-label">Start</span>
                <span className="admin-range-calendar-pill-value">{startLabel}</span>
              </div>
              <div className="admin-range-calendar-pill-divider" aria-hidden="true" />
              <div
                className={`admin-range-calendar-pill${
                  phase === "end" ? " is-active" : ""
                }${endIso ? " has-value" : ""}`}
              >
                <span className="admin-range-calendar-pill-label">End</span>
                <span className="admin-range-calendar-pill-value">{endLabel}</span>
              </div>
            </div>

            <div className="admin-range-calendar-body">
              <div className="admin-range-calendar-nav">
                <button
                  type="button"
                  className="admin-range-calendar-nav-btn"
                  onClick={() => shiftMonth(-1)}
                  disabled={disabled}
                  aria-label="Previous month"
                >
                  <CalendarChevron direction="prev" />
                </button>
                <p className="admin-range-calendar-month mb-0">
                  {monthLabel(viewYear, viewMonth)}
                </p>
                <button
                  type="button"
                  className="admin-range-calendar-nav-btn"
                  onClick={() => shiftMonth(1)}
                  disabled={disabled}
                  aria-label="Next month"
                >
                  <CalendarChevron direction="next" />
                </button>
              </div>

              <div className="admin-range-calendar-weekdays" aria-hidden="true">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="admin-range-calendar-grid">
                {cells.map((cell, index) => {
                  if (!cell.inMonth) {
                    return (
                      <span
                        key={`empty-${index}`}
                        className="admin-range-calendar-empty"
                      />
                    );
                  }

                  const state = dayState(cell.iso);
                  const className = [
                    "admin-range-calendar-day",
                    state.isToday ? "is-today" : "",
                    state.isStart ? "is-start" : "",
                    state.isEnd ? "is-end" : "",
                    state.inRange ? "is-in-range" : "",
                    state.isPreview ? "is-preview-end" : "",
                    state.isDisabledDay ? "is-disabled" : "",
                    state.isStart && state.isEnd ? "is-same-day" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      className={className}
                      disabled={disabled || state.isDisabledDay}
                      aria-label={cell.iso}
                      aria-pressed={state.isStart || state.isEnd}
                      onClick={() => handleDayClick(cell.iso)}
                      onMouseEnter={() => {
                        if (phase === "end" && startIso && !disabled) {
                          setHoverIso(cell.iso);
                        }
                      }}
                      onMouseLeave={() => setHoverIso(null)}
                    >
                      <span className="admin-range-calendar-day-num">{cell.day}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="admin-range-calendar-footer">
              <p className="admin-range-calendar-hint mb-0">
                {phase === "end" && startIso
                  ? "Select an end date — same day works for one-day events."
                  : startIso && endIso
                    ? "Done. Click outside or pick a new start date."
                    : "Select a start date, then an end date."}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <input type="hidden" name={name} value={value} required={required} />
      {helpText ? <p className="admin-field-help">{helpText}</p> : null}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="16" height="16">
      <rect
        x="3"
        y="4.5"
        width="14"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M3 8h14" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7 3v3M13 3v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarChevron({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="16" height="16">
      {direction === "prev" ? (
        <path
          d="M12.5 4.5 7 10l5.5 5.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M7.5 4.5 13 10l-5.5 5.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      width="14"
      height="14"
      className={open ? "is-open" : undefined}
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
