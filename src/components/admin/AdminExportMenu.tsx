"use client";

import { useEffect, useRef, useState } from "react";
import type { ExportFormat } from "@/lib/export/types";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  pdf: "PDF",
  xlsx: "Excel",
};

const MENU_ANIMATION_MS = 180;

export function AdminExportMenu({
  type,
  eventId,
  label = "Export",
}: {
  type: "financial" | "participants" | "evaluation" | "approved-participants";
  eventId?: string | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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

    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function download(format: ExportFormat) {
    setError(null);
    setLoading(format);
    setOpen(false);

    try {
      const params = new URLSearchParams({ format });
      if (eventId) params.set("eventId", eventId);

      const response = await fetch(`/api/admin/export/${type}?${params.toString()}`);
      if (!response.ok) {
        let message = `Export failed (${response.status}).`;
        const text = await response.text();
        try {
          const data = JSON.parse(text) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          if (text.trim()) message = text.slice(0, 180);
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `pna-${type}-export.${format === "xlsx" ? "xlsx" : format}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={`admin-export-menu${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="admin-export-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={Boolean(loading)}
        onClick={() => setOpen((current) => !current)}
      >
        {loading ? `Exporting ${FORMAT_LABELS[loading]}...` : label}
        <svg className="admin-export-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {rendered ? (
        <div
          className={`admin-export-dropdown${visible ? " is-visible" : ""}`}
          role="menu"
        >
          {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((format, index) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              className="admin-export-option"
              style={{ animationDelay: `${40 + index * 35}ms` }}
              onClick={() => void download(format)}
            >
              Download {FORMAT_LABELS[format]}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="admin-export-error">{error}</p> : null}
    </div>
  );
}
