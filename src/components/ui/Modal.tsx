"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "default" | "large" | "overview";
  hideHeader?: boolean;
  containScroll?: boolean;
  contentClassName?: string;
  dialogClassName?: string;
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
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const useContainedLayout = hideHeader || containScroll;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-accent-deep/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className={`relative w-full rounded-2xl bg-surface border border-accent/25 shadow-2xl shadow-accent-deep/20 animate-fade-in-up ${
          useContainedLayout
            ? "flex flex-col h-[min(92dvh,880px)] max-h-[min(92dvh,880px)] overflow-hidden"
            : "overflow-y-auto max-h-[min(92dvh,880px)]"
        } ${
          size === "large"
            ? "max-w-6xl"
            : size === "overview"
              ? "max-w-4xl"
              : "max-w-lg"
        } ${dialogClassName}`}
      >
        {!hideHeader && (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-accent/20 bg-surface/95 backdrop-blur px-4 sm:px-6 py-3 sm:py-4 rounded-t-2xl sm:rounded-t-2xl flex-shrink-0">
            {title && (
              <h2 id="modal-title" className="font-display text-lg font-bold text-ink">
                {title}
              </h2>
            )}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink transition-colors"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div
          className={`${useContainedLayout ? "flex flex-col flex-1 min-h-0 overflow-hidden" : ""} ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
