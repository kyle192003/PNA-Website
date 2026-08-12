"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isNcrRegion, PNA_NCR_ZONES, PNA_ZONES } from "@/lib/conference";

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

type MenuView = "regions" | "ncr-zones";

const MENU_ANIMATION_MS = 180;
const MENU_GAP_PX = 8;
const MENU_MAX_HEIGHT_PX = 220;

const REGION_OPTIONS = PNA_ZONES.map((zone) => ({ value: zone, label: zone }));

function searchableText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function getDisplayLabel(zone: string, ncrZone: string, placeholder: string): string {
  if (!zone) return placeholder;
  if (isNcrRegion(zone)) {
    return ncrZone ? `NCR — ${ncrZone}` : "NCR";
  }
  return zone;
}

type PnaRegionSelectProps = {
  id?: string;
  zone: string;
  ncrZone: string;
  onChange: (zone: string, ncrZone: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  "aria-label"?: string;
};

export function PnaRegionSelect({
  id,
  zone,
  ncrZone,
  onChange,
  placeholder = "Select PNA zone/region",
  disabled = false,
  className = "",
  searchable = false,
  searchPlaceholder = "Search zone/region...",
  "aria-label": ariaLabel,
}: PnaRegionSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>("regions");
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const hasSelection = Boolean(zone) && (!isNcrRegion(zone) || Boolean(ncrZone));
  const displayLabel = getDisplayLabel(zone, ncrZone, placeholder);

  const filteredRegions = useMemo(() => {
    if (!searchable || menuView !== "regions") return REGION_OPTIONS;
    const query = searchableText(searchQuery.trim());
    if (!query) return REGION_OPTIONS;
    return REGION_OPTIONS.filter((option) =>
      searchableText(`${option.label} ${option.value}`).includes(query)
    );
  }, [searchable, searchQuery, menuView]);

  const menuOptionCount = menuView === "regions" ? filteredRegions.length : PNA_NCR_ZONES.length;

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
      setMenuView("regions");
    }, MENU_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open || !searchable || menuView !== "regions") return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, searchable, menuView]);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const anchor = rootRef.current ?? triggerRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 8;
      const width = Math.min(
        Math.max(rect.width, 120),
        Math.max(120, window.innerWidth - viewportPadding * 2)
      );
      let left = rect.left;
      left = Math.min(
        Math.max(left, viewportPadding),
        window.innerWidth - width - viewportPadding
      );

      const measuredHeight = menuRef.current?.offsetHeight;
      const estimatedHeight = Math.min(
        Math.max(menuOptionCount, 1) * 44 +
          (searchable && menuView === "regions" ? 56 : menuView === "ncr-zones" ? 48 : 16),
        MENU_MAX_HEIGHT_PX + (searchable && menuView === "regions" ? 56 : menuView === "ncr-zones" ? 48 : 0)
      );
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
  }, [open, menuOptionCount, rendered, visible, searchable, menuView]);

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
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggleOpen() {
    if (disabled) return;
    setOpen((prev) => !prev);
  }

  function closeMenu() {
    setOpen(false);
  }

  function chooseRegion(nextZone: string) {
    if (nextZone === "NCR") {
      onChange("NCR", ncrZone);
      setMenuView("ncr-zones");
      setSearchQuery("");
      return;
    }
    onChange(nextZone, "");
    closeMenu();
  }

  function chooseNcrZone(nextZone: string) {
    onChange("NCR", nextZone);
    closeMenu();
  }

  const showMenu = mounted && rendered && menuPosition;

  const menu = showMenu
    ? createPortal(
        <div
          ref={menuRef}
          className={`pna-select-menu pna-select-menu--portal${searchable && menuView === "regions" ? " pna-select-menu--searchable" : ""}${visible ? " is-visible" : ""}`}
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
          {menuView === "ncr-zones" ? (
            <>
              <button
                type="button"
                className="pna-region-select-back"
                onClick={() => setMenuView("regions")}
              >
                ← All regions
              </button>
              <div className="pna-select-options">
                {PNA_NCR_ZONES.map((option, index) => {
                  const isActive = option === ncrZone;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      className={`pna-select-option${isActive ? " pna-select-option--active" : ""}`}
                      aria-selected={isActive}
                      style={{ animationDelay: `${30 + index * 28}ms` }}
                      onClick={() => chooseNcrZone(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
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
                        closeMenu();
                      }
                    }}
                  />
                </div>
              ) : null}
              <div className="pna-select-options">
                {filteredRegions.length === 0 ? (
                  <p className="pna-select-empty mb-0">No matching options</p>
                ) : (
                  filteredRegions.map((option, index) => {
                    const isActive =
                      option.value === zone && (!isNcrRegion(option.value) || Boolean(ncrZone));
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        className={`pna-select-option${isActive ? " pna-select-option--active" : ""}${option.value === "NCR" ? " pna-select-option--has-submenu" : ""}`}
                        aria-selected={isActive}
                        style={{
                          animationDelay: `${30 + index * 28}ms`,
                          ...(option.value === "NCR" ? { width: "100%" } : {}),
                        }}
                        onClick={() => chooseRegion(option.value)}
                      >
                        <span className="pna-region-select-option-label">{option.label}</span>
                        {option.value === "NCR" ? (
                          <span className="pna-region-select-submenu-chevron" aria-hidden="true">
                            ›
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div
      ref={rootRef}
      className={`pna-select pna-region-select ${open ? "pna-select--open" : ""} ${disabled ? "pna-select--disabled" : ""} ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        className="pna-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggleOpen}
      >
        <span
          className={`pna-select-trigger-label${!hasSelection ? " pna-select-trigger-label--placeholder" : ""}`}
        >
          {hasSelection ? displayLabel : placeholder}
        </span>
      </button>

      {menu}
    </div>
  );
}
