"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PhPlaceSuggestion, PhPlaceType } from "@/lib/ph-locations";

type PhLocationSuggestProps = {
  id: string;
  label: string;
  type: PhPlaceType;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: PhPlaceSuggestion) => void;
  onBlur?: () => void;
  required?: boolean;
  error?: string;
  placeholder?: string;
  className?: string;
};

export function PhLocationSuggest({
  id,
  label,
  type,
  value,
  onChange,
  onSelect,
  onBlur,
  required = false,
  error,
  placeholder,
  className = "col-12 col-md-6",
}: PhLocationSuggestProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PhPlaceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query, type });
        const res = await fetch(`/api/places/ph?${params}`, { signal: controller.signal });
        const data = await res.json();
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value, type]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function chooseSuggestion(suggestion: PhPlaceSuggestion) {
    const nextValue =
      type === "street"
        ? suggestion.street || suggestion.label
        : type === "city"
          ? suggestion.city || suggestion.label
          : suggestion.province || suggestion.label;

    onChange(nextValue);
    onSelect?.(suggestion);
    setOpen(false);
    setSuggestions([]);
  }

  const showList = open && (loading || suggestions.length > 0 || value.trim().length >= 2);

  return (
    <div className={className} ref={rootRef}>
      <label htmlFor={id} className="form-label registration-form-label">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      <div className="ph-location-suggest">
        <input
          type="text"
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          className={`input-dark ${error ? "input-dark-error" : ""}`}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => onBlur?.()}
          onKeyDown={(e) => {
            if (!showList || suggestions.length === 0) return;

            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((prev) => (prev + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              chooseSuggestion(suggestions[activeIndex]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />

        {showList ? (
          <ul id={listId} className="ph-location-suggest-list" role="listbox">
            {loading && suggestions.length === 0 ? (
              <li className="ph-location-suggest-empty">Searching Philippines…</li>
            ) : null}
            {!loading && suggestions.length === 0 ? (
              <li className="ph-location-suggest-empty">No matching places found</li>
            ) : null}
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  className={`ph-location-suggest-option${index === activeIndex ? " is-active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chooseSuggestion(suggestion)}
                >
                  {suggestion.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
