"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatLongDate, todayIsoInTimeZone } from "@/lib/event-date";

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

export type SingleDatePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  /** Called when the picker closes or a date is chosen (finished interacting). */
  onBlur?: (isoDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  helpText?: string;
};

/**
 * Single-date dropdown calendar matching the admin dashboard date picker UI.
 * Value is stored as YYYY-MM-DD.
 */
export function SingleDatePicker({
  id,
  label,
  value,
  onChange,
  onBlur,
  required = false,
  disabled = false,
  error,
  min,
  max,
  placeholder = "Select date",
  className = "col-12 col-md-6",
  helpText,
}: SingleDatePickerProps) {
  const todayIso = todayIsoInTimeZone();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);

  const selected = parseIso(value);
  const focus = selected ?? parseIso(todayIso) ?? { y: new Date().getFullYear(), m: 1, d: 1 };
  const [viewYear, setViewYear] = useState(focus.y);
  const [viewMonth, setViewMonth] = useState(focus.m - 1);

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
        onBlur?.(value);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        onBlur?.(value);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onBlur, value]);

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(viewYear, viewMonth + delta, 1, 12));
    setViewYear(date.getUTCFullYear());
    setViewMonth(date.getUTCMonth());
  }

  function openCalendar() {
    if (disabled) return;
    const focusDate = parseIso(value) ?? parseIso(todayIso);
    if (focusDate) {
      setViewYear(focusDate.y);
      setViewMonth(focusDate.m - 1);
    }
    setOpen(true);
  }

  function isDisabledDay(iso: string): boolean {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  function handleDayClick(iso: string) {
    if (disabled || isDisabledDay(iso)) return;
    onChange(iso);
    setOpen(false);
    onBlur?.(iso);
    triggerRef.current?.focus();
  }

  function clearSelection(event?: React.MouseEvent) {
    event?.stopPropagation();
    if (disabled) return;
    onChange("");
    onBlur?.("");
  }

  const displayValue = value ? formatLongDate(value) : placeholder;

  return (
    <div className={`${className} admin-date-field registration-date-field`.trim()} ref={rootRef}>
      <label className="form-label registration-form-label" htmlFor={id}>
        {label} {required ? <span className="text-accent">*</span> : null}
      </label>

      <div className={`admin-range-dropdown${open ? " is-open" : ""}`}>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          className={`admin-range-dropdown-trigger${value ? " has-value" : ""}${
            open ? " is-open" : ""
          }${error ? " is-error" : ""}`}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          aria-invalid={Boolean(error)}
          onClick={() => {
            if (open) {
              setOpen(false);
              onBlur?.(value);
              return;
            }
            openCalendar();
          }}
        >
          <span className="admin-range-dropdown-trigger-icon" aria-hidden="true">
            <CalendarIcon />
          </span>
          <span className="admin-range-dropdown-trigger-text">{displayValue}</span>
          <span className="admin-range-dropdown-trigger-caret" aria-hidden="true">
            <CaretIcon open={open} />
          </span>
        </button>

        {value && !disabled ? (
          <button
            type="button"
            className="admin-range-dropdown-clear-btn"
            onClick={clearSelection}
            aria-label={`Clear ${label}`}
          >
            Clear
          </button>
        ) : null}

        {rendered ? (
          <div
            id={`${id}-panel`}
            className={`admin-range-calendar admin-range-calendar--dropdown${
              visible ? " is-visible" : ""
            }`}
            role="dialog"
            aria-label={label}
          >
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
                      <span key={`empty-${index}`} className="admin-range-calendar-empty" />
                    );
                  }

                  const selectedDay = Boolean(value && cell.iso === value);
                  const isToday = cell.iso === todayIso;
                  const dayDisabled = isDisabledDay(cell.iso);
                  const className = [
                    "admin-range-calendar-day",
                    isToday ? "is-today" : "",
                    selectedDay ? "is-start is-end is-same-day" : "",
                    dayDisabled ? "is-disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      className={className}
                      disabled={disabled || dayDisabled}
                      aria-label={formatLongDate(cell.iso)}
                      aria-pressed={selectedDay}
                      onClick={() => handleDayClick(cell.iso)}
                    >
                      <span className="admin-range-calendar-day-num">{cell.day}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="admin-range-calendar-footer">
              <p className="admin-range-calendar-hint mb-0">
                {value
                  ? `Selected ${formatLongDate(value)}. Click outside to close.`
                  : "Select a date from the calendar."}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {helpText ? <p className="registration-form-help mt-1 mb-0">{helpText}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
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
