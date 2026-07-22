"use client";

import {
  formatDateRangeDisplay,
  formatLongDate,
  parseEventEndDate,
  parseEventStartDate,
  parseLooseDateToIso,
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
};

/** Start/end date range that saves a display string like "October 14 to 16, 2026". */
export function AdminDateRangeInput({
  id,
  name,
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  helpText,
}: AdminDateRangeInputProps) {
  const startIso = parseEventStartDate(value) ?? "";
  const endIso = parseEventEndDate(value) ?? startIso;

  function updateRange(nextStart: string, nextEnd: string) {
    if (!nextStart && !nextEnd) {
      onChange("");
      return;
    }

    const start = nextStart || nextEnd;
    const end = nextEnd || nextStart;
    const orderedStart = start <= end ? start : end;
    const orderedEnd = start <= end ? end : start;
    onChange(formatDateRangeDisplay(orderedStart, orderedEnd));
  }

  return (
    <div className="admin-date-field">
      <label className="admin-label" htmlFor={`${id}-start`}>
        {label}
      </label>
      <div className="admin-date-range">
        <div className="admin-date-control">
          <span className="admin-date-sublabel">Start</span>
          <input
            id={`${id}-start`}
            type="date"
            className="admin-input admin-date-input"
            value={startIso}
            required={required}
            disabled={disabled}
            onChange={(event) => updateRange(event.target.value, endIso)}
          />
        </div>
        <span className="admin-date-range-sep" aria-hidden="true">
          to
        </span>
        <div className="admin-date-control">
          <span className="admin-date-sublabel">End</span>
          <input
            id={`${id}-end`}
            type="date"
            className="admin-input admin-date-input"
            value={endIso}
            required={required}
            disabled={disabled}
            min={startIso || undefined}
            onChange={(event) => updateRange(startIso, event.target.value)}
          />
        </div>
      </div>
      <input type="hidden" name={name} value={value} />
      {value ? <p className="admin-date-preview">{value}</p> : null}
      {helpText ? <p className="admin-field-help">{helpText}</p> : null}
    </div>
  );
}
