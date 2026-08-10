"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatLongDate, todayIsoInTimeZone } from "@/lib/event-date";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const DROPDOWN_ANIMATION_MS = 160;
const CALENDAR_GAP_PX = 6;
const VIEWPORT_PADDING_PX = 8;
const YEAR_PAGE_SIZE = 12;

type CalendarPosition = {
  top: number;
  left: number;
  width: number;
  openUpward: boolean;
};

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

const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function getYearBounds(min?: string, max?: string): { minYear: number; maxYear: number } {
  const currentYear = new Date().getFullYear();
  const minYear = parseIso(min ?? "")?.y ?? 1900;
  const maxYear = parseIso(max ?? "")?.y ?? currentYear + 40;
  return {
    minYear: Math.min(minYear, maxYear),
    maxYear: Math.max(minYear, maxYear),
  };
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

type CalendarPanel = "days" | "months" | "years";

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
  /** Prefer opening the calendar above the field (useful near the bottom of the form). */
  placement?: "auto" | "top" | "bottom";
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
  placement = "auto",
}: SingleDatePickerProps) {
  const todayIso = todayIsoInTimeZone();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelPosition, setPanelPosition] = useState<CalendarPosition | null>(null);
  const [panel, setPanel] = useState<CalendarPanel>("days");
  const errorId = `${id}-error`;

  const selected = parseIso(value);
  const focus = selected ?? parseIso(todayIso) ?? { y: new Date().getFullYear(), m: 1, d: 1 };
  const [viewYear, setViewYear] = useState(focus.y);
  const [viewMonth, setViewMonth] = useState(focus.m - 1);
  const [yearPageStart, setYearPageStart] = useState(
    Math.floor(focus.y / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE
  );

  const { minYear, maxYear } = useMemo(() => getYearBounds(min, max), [min, max]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    setPanel("days");
    const timeout = window.setTimeout(() => {
      setRendered(false);
      setPanelPosition(null);
    }, DROPDOWN_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const rootFontSize =
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const maxWidth = 22.5 * rootFontSize;
      const width = Math.min(rect.width, maxWidth);
      let left = rect.left;
      left = Math.min(
        Math.max(left, VIEWPORT_PADDING_PX),
        window.innerWidth - width - VIEWPORT_PADDING_PX
      );

      const measuredHeight = panelRef.current?.offsetHeight;
      const estimatedHeight = 320;
      const calendarHeight = measuredHeight ?? estimatedHeight;
      const spaceBelow = window.innerHeight - rect.bottom - CALENDAR_GAP_PX;

      let openUpward = false;
      if (placement === "top") {
        openUpward = true;
      } else if (placement === "bottom") {
        openUpward = false;
      } else {
        openUpward = spaceBelow < calendarHeight && rect.top > spaceBelow;
      }

      const top = openUpward
        ? Math.max(VIEWPORT_PADDING_PX, rect.top - calendarHeight - CALENDAR_GAP_PX)
        : rect.bottom + CALENDAR_GAP_PX;

      setPanelPosition({ top, left, width, openUpward });
    }

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, panel, rendered, visible, placement, viewYear, viewMonth, yearPageStart]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      onBlur?.(value);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (panel !== "days") {
          setPanel("days");
          return;
        }
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
  }, [open, onBlur, value, panel]);

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const yearPageYears = useMemo(() => {
    const years: number[] = [];
    for (let year = yearPageStart; year < yearPageStart + YEAR_PAGE_SIZE; year += 1) {
      years.push(year);
    }
    return years;
  }, [yearPageStart]);

  function shiftMonth(delta: number) {
    const date = new Date(Date.UTC(viewYear, viewMonth + delta, 1, 12));
    const nextYear = date.getUTCFullYear();
    setViewYear(nextYear);
    setViewMonth(date.getUTCMonth());
    setYearPageStart(Math.floor(nextYear / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE);
  }

  function shiftYearPage(delta: number) {
    setYearPageStart((current) => {
      const next = current + delta * YEAR_PAGE_SIZE;
      const clampedStart = Math.min(
        Math.max(next, Math.floor(minYear / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE),
        Math.floor(maxYear / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE
      );
      return clampedStart;
    });
  }

  function seedPanelPosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const rootFontSize =
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const width = Math.min(rect.width, 22.5 * rootFontSize);

    setPanelPosition({
      top: rect.bottom + CALENDAR_GAP_PX,
      left: Math.max(VIEWPORT_PADDING_PX, rect.left),
      width,
      openUpward: placement === "top",
    });
  }

  function openCalendar() {
    if (disabled) return;
    const focusDate = parseIso(value) ?? parseIso(todayIso);
    if (focusDate) {
      setViewYear(focusDate.y);
      setViewMonth(focusDate.m - 1);
      setYearPageStart(Math.floor(focusDate.y / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE);
    }
    setPanel("days");
    seedPanelPosition();
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

  function handleMonthPick(monthIndex: number) {
    setViewMonth(monthIndex);
    setPanel("days");
  }

  function handleYearPick(year: number) {
    if (year < minYear || year > maxYear) return;
    setViewYear(year);
    setPanel("months");
  }

  function clearSelection(event?: React.MouseEvent) {
    event?.stopPropagation();
    if (disabled) return;
    onChange("");
    onBlur?.("");
  }

  const displayValue = value ? formatLongDate(value) : placeholder;
  const monthLabel = MONTH_OPTIONS[viewMonth];
  const yearPageEnd = Math.min(yearPageStart + YEAR_PAGE_SIZE - 1, maxYear);
  const canPrevYearPage = yearPageStart > minYear;
  const canNextYearPage = yearPageStart + YEAR_PAGE_SIZE <= maxYear;

  const showPanel = mounted && rendered && panelPosition;

  const calendarPanel = showPanel ? (
    <div
      ref={panelRef}
      id={`${id}-panel`}
      className={`admin-range-calendar admin-range-calendar--dropdown admin-range-calendar--portal${
        panelPosition.openUpward ? " admin-range-calendar--dropdown-top" : ""
      }${visible ? " is-visible" : ""}`}
      role="dialog"
      aria-label={label}
      style={{
        top: panelPosition.top,
        left: panelPosition.left,
        width: panelPosition.width,
      }}
    >
      <div className="admin-range-calendar-body">
        <div className="admin-range-calendar-nav">
          <button
            type="button"
            className="admin-range-calendar-nav-btn"
            onClick={() => {
              if (panel === "years") shiftYearPage(-1);
              else shiftMonth(-1);
            }}
            disabled={disabled || (panel === "years" ? !canPrevYearPage : false)}
            aria-label={panel === "years" ? "Previous years" : "Previous month"}
          >
            <CalendarChevron direction="prev" />
          </button>

          <div className="admin-range-calendar-month-controls">
            {panel === "years" ? (
              <p className="admin-range-calendar-month mb-0">
                {yearPageStart} – {yearPageEnd}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className={`admin-range-calendar-header-btn${
                    panel === "months" ? " is-active" : ""
                  }`}
                  disabled={disabled}
                  aria-label="Choose month"
                  onClick={() => setPanel((current) => (current === "months" ? "days" : "months"))}
                >
                  {monthLabel}
                </button>
                <button
                  type="button"
                  className="admin-range-calendar-header-btn"
                  disabled={disabled}
                  aria-label="Choose year"
                  onClick={() => {
                    setYearPageStart(Math.floor(viewYear / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE);
                    setPanel("years");
                  }}
                >
                  {viewYear}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className="admin-range-calendar-nav-btn"
            onClick={() => {
              if (panel === "years") shiftYearPage(1);
              else shiftMonth(1);
            }}
            disabled={disabled || (panel === "years" ? !canNextYearPage : false)}
            aria-label={panel === "years" ? "Next years" : "Next month"}
          >
            <CalendarChevron direction="next" />
          </button>
        </div>

        {panel === "days" ? (
          <>
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
                const dayClassName = [
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
                    className={dayClassName}
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
          </>
        ) : null}

        {panel === "months" ? (
          <div className="admin-range-calendar-picker-grid" role="listbox" aria-label="Select month">
            {MONTH_OPTIONS.map((monthName, index) => {
              const selectedMonth = index === viewMonth;
              return (
                <button
                  key={monthName}
                  type="button"
                  role="option"
                  className={`admin-range-calendar-picker-item${
                    selectedMonth ? " is-selected" : ""
                  }`}
                  aria-selected={selectedMonth}
                  disabled={disabled}
                  onClick={() => handleMonthPick(index)}
                >
                  {monthName.slice(0, 3)}
                </button>
              );
            })}
          </div>
        ) : null}

        {panel === "years" ? (
          <div className="admin-range-calendar-picker-grid" role="listbox" aria-label="Select year">
            {yearPageYears.map((year) => {
              const outOfRange = year < minYear || year > maxYear;
              const selectedYear = year === viewYear;
              return (
                <button
                  key={year}
                  type="button"
                  role="option"
                  className={`admin-range-calendar-picker-item${
                    selectedYear ? " is-selected" : ""
                  }`}
                  aria-selected={selectedYear}
                  disabled={disabled || outOfRange}
                  onClick={() => handleYearPick(year)}
                >
                  {year}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="admin-range-calendar-footer">
        <p className="admin-range-calendar-hint mb-0">
          {panel === "years"
            ? "Choose a year inside the calendar."
            : panel === "months"
              ? "Choose a month inside the calendar."
              : value
                ? `Selected ${formatLongDate(value)}. Click outside to close.`
                : "Select a date from the calendar."}
        </p>
      </div>
    </div>
  ) : null;

  const portaledCalendar = showPanel
    ? createPortal(
        <div className="registration-date-field">{calendarPanel}</div>,
        document.body
      )
    : null;

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
          aria-describedby={error ? errorId : undefined}
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

        {portaledCalendar}
      </div>

      {helpText ? <p className="registration-form-help mt-1 mb-0">{helpText}</p> : null}
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-red-400">
          {error}
        </p>
      ) : null}
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
