"use client";

import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type PnaSelectOption = {
  value: string;
  label: string;
  /** Optional group header (e.g. NCR Zone 1). */
  group?: string;
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
  searchable?: boolean;
  searchPlaceholder?: string;
  "aria-label"?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

const MENU_ANIMATION_MS = 180;
const MENU_GAP_PX = 8;
const MENU_MAX_HEIGHT_PX = 220;

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
  searchable = false,
  searchPlaceholder = "Search...",
  "aria-label": ariaLabel,
}: PnaSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const selectedLabel = selected
    ? selected.group
      ? `${selected.label} (${selected.group})`
      : selected.label
    : null;

  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query) ||
        (option.group?.toLowerCase().includes(query) ?? false)
    );
  }, [options, searchable, searchQuery]);

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
    const timeout = window.setTimeout(() => {
      setRendered(false);
      setMenuPosition(null);
      setSearchQuery("");
    }, MENU_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open || !searchable) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, searchable]);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      // Keep menu width locked to the trigger (strict field width).
      const width = Math.min(
        Math.max(rect.width, 1),
        Math.max(120, window.innerWidth - viewportPadding * 2)
      );
      let left = rect.left;
      left = Math.min(
        Math.max(left, viewportPadding),
        window.innerWidth - width - viewportPadding
      );

      const measuredHeight = menuRef.current?.offsetHeight;
      const estimatedHeight =
        Math.min(Math.max(filteredOptions.length, 1) * 44 + (searchable ? 56 : 16), MENU_MAX_HEIGHT_PX + (searchable ? 56 : 0));
      const menuHeight = measuredHeight ?? estimatedHeight;
      const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP_PX;
      const openUpward = spaceBelow < menuHeight && rect.top > spaceBelow;
      const top = openUpward
        ? Math.max(viewportPadding, rect.top - menuHeight - MENU_GAP_PX)
        : rect.bottom + MENU_GAP_PX;

      setMenuPosition({ top, left, width });
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
  }, [open, filteredOptions.length, rendered, visible, searchable]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
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

  const showMenu = mounted && rendered && menuPosition;

  const menu = showMenu
    ? createPortal(
        <div
          ref={menuRef}
          className={`pna-select-menu pna-select-menu--portal${searchable ? " pna-select-menu--searchable" : ""}${visible ? " is-visible" : ""}`}
          role="listbox"
          aria-labelledby={selectId}
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            zIndex: 10000,
          }}
        >
          <span className="pna-select-caret" aria-hidden="true" />
          {searchable ? (
            <div className="pna-select-search">
              <input
                ref={searchRef}
                type="search"
                className="pna-select-search-input"
                value={searchQuery}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setOpen(false);
                  }
                }}
              />
            </div>
          ) : null}
          <div className="pna-select-options">
            {filteredOptions.length === 0 ? (
              <p className="pna-select-empty mb-0">No matching options</p>
            ) : (
              filteredOptions.map((option, index) => {
                const isActive = option.value === value;
                const prevGroup = filteredOptions[index - 1]?.group;
                const showGroup =
                  Boolean(option.group) && option.group !== prevGroup && option.value !== "";
                return (
                  <Fragment key={`${option.value}-${option.label}-${option.group ?? ""}`}>
                    {showGroup ? (
                      <div className="pna-select-group" role="presentation">
                        {option.group}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      role="option"
                      className={`pna-select-option${isActive ? " pna-select-option--active" : ""}`}
                      aria-selected={isActive}
                      style={{ animationDelay: `${30 + index * 28}ms` }}
                      onClick={() => choose(option.value)}
                    >
                      {option.label}
                    </button>
                  </Fragment>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div
      ref={rootRef}
      className={`pna-select ${open ? "pna-select--open" : ""} ${disabled ? "pna-select--disabled" : ""} ${className}`.trim()}
    >
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}

      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        className="pna-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              setRendered(true);
              const trigger = triggerRef.current;
              if (trigger) {
                const rect = trigger.getBoundingClientRect();
                const width = Math.max(rect.width, 1);
                setMenuPosition({
                  top: rect.bottom + MENU_GAP_PX,
                  left: Math.max(8, rect.left),
                  width,
                });
              }
            }
            return next;
          });
        }}
      >
        <span
          className={`pna-select-trigger-label${!selected ? " pna-select-trigger-label--placeholder" : ""}`}
        >
          {selectedLabel ?? placeholder}
        </span>
      </button>

      {menu}
    </div>
  );
}
