"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type PnaSelectOption = {
  value: string;
  label: string;
};

type PnaSelectProps = {
  id?: string;
  name?: string;
  value: string;
  options: PnaSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
};

const MENU_ANIMATION_MS = 180;

export function PnaSelect({
  id,
  name,
  value,
  options,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  required = false,
  className = "",
  "aria-label": ariaLabel,
}: PnaSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timeout = window.setTimeout(() => setRendered(false), MENU_ANIMATION_MS);
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
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`pna-select ${open ? "pna-select--open" : ""} ${disabled ? "pna-select--disabled" : ""} ${className}`.trim()}
    >
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}

      <button
        id={selectId}
        type="button"
        className="pna-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
      >
        <span
          className={`pna-select-trigger-label${!selected ? " pna-select-trigger-label--placeholder" : ""}`}
        >
          {selected?.label ?? placeholder}
        </span>
        <span className="pna-select-chevron" aria-hidden="true" />
      </button>

      {rendered ? (
        <div
          className={`pna-select-menu${visible ? " is-visible" : ""}`}
          role="listbox"
          aria-labelledby={selectId}
        >
          <span className="pna-select-caret" aria-hidden="true" />
          {options.map((option, index) => {
            const isActive = option.value === value;
            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                role="option"
                className={`pna-select-option${isActive ? " pna-select-option--active" : ""}`}
                aria-selected={isActive}
                style={{ animationDelay: `${30 + index * 28}ms` }}
                onClick={() => choose(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
