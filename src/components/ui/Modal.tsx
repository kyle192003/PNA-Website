"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "default" | "large" | "overview" | "fullscreen";
  hideHeader?: boolean;
  containScroll?: boolean;
  contentClassName?: string;
  dialogClassName?: string;
  /** Raise above other open modals (e.g. confirmation over registration form). */
  elevated?: boolean;
  /** Optional id of an existing title element when hideHeader is true. */
  labelledBy?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "default",
  hideHeader = false,
  containScroll = false,
  contentClassName = "p-4 sm:p-6",
  dialogClassName = "",
  elevated = false,
  labelledBy,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const generatedTitleId = useId();
  const titleId = title ? generatedTitleId : labelledBy;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function getFocusable(): HTMLElement[] {
      const root = dialogRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1 && el.offsetParent !== null);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    const frame = window.requestAnimationFrame(() => {
      const focusable = getFocusable();
      (focusable[0] ?? dialogRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const isFullscreen = size === "fullscreen";
  const useContainedLayout = hideHeader || containScroll || isFullscreen;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center ${
        isFullscreen || elevated ? "z-[1400]" : "z-[1100]"
      } ${isFullscreen ? "p-0" : "p-3 sm:p-4"}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-accent-deep/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close dialog"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full bg-surface border border-accent/25 shadow-2xl shadow-accent-deep/20 animate-fade-in-up outline-none ${
          isFullscreen
            ? "flex flex-col h-[100dvh] max-h-[100dvh] max-w-none rounded-none overflow-hidden"
            : useContainedLayout
              ? "flex flex-col h-[min(92dvh,880px)] max-h-[min(92dvh,880px)] overflow-hidden rounded-2xl"
              : "overflow-y-auto max-h-[min(92dvh,880px)] rounded-2xl"
        } ${
          size === "large"
            ? "max-w-6xl"
            : size === "overview"
              ? "max-w-4xl"
              : size === "fullscreen"
                ? ""
                : "max-w-lg"
        } ${dialogClassName}`}
      >
        {!hideHeader && (
          <div
            className={`sticky top-0 z-10 flex items-center justify-between border-b border-accent/20 bg-surface/95 backdrop-blur px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0 ${
              isFullscreen ? "rounded-none" : "rounded-t-2xl"
            }`}
          >
            {title && (
              <h2 id={generatedTitleId} className="font-display text-lg font-bold text-ink">
                {title}
              </h2>
            )}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink transition-colors"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div
          className={`${
            useContainedLayout ? "flex flex-col flex-1 min-h-0 overflow-y-auto" : ""
          } ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
