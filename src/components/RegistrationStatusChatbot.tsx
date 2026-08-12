"use client";

import { useEffect, useId, useState } from "react";
import { RegistrationLookup } from "@/components/RegistrationLookup";
import { useRegistrationModal } from "@/providers/RegistrationProvider";

const TIP_TEXT = "Are you looking for your pending registration?";
const TIP_VISIBLE_MS = 4000;
const TIP_GAP_MS = 10000;

export function RegistrationStatusChatbot() {
  const { isRegistrationOpen } = useRegistrationModal();
  const [open, setOpen] = useState(false);
  const [tipVisible, setTipVisible] = useState(false);
  const panelId = useId();
  const hidden = isRegistrationOpen;

  useEffect(() => {
    if (hidden) {
      setOpen(false);
      setTipVisible(false);
    }
  }, [hidden]);

  useEffect(() => {
    if (open || hidden) {
      setTipVisible(false);
      return;
    }

    let visibleTimer: number | undefined;
    let gapTimer: number | undefined;
    let cancelled = false;

    const showTip = () => {
      if (cancelled) return;
      setTipVisible(true);
      visibleTimer = window.setTimeout(() => {
        if (cancelled) return;
        setTipVisible(false);
        gapTimer = window.setTimeout(showTip, TIP_GAP_MS);
      }, TIP_VISIBLE_MS);
    };

    const start = window.setTimeout(showTip, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
      if (visibleTimer) window.clearTimeout(visibleTimer);
      if (gapTimer) window.clearTimeout(gapTimer);
    };
  }, [open, hidden]);

  useEffect(() => {
    if (!open || hidden) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, hidden]);

  if (hidden) return null;

  return (
    <div className="registration-status-chatbot" aria-live="polite">
      {open ? (
        <div
          id={panelId}
          className="registration-status-chatbot-panel"
          role="dialog"
          aria-label="Check registration status"
        >
          <div className="registration-status-chatbot-panel-head">
            <div>
              <p className="registration-status-chatbot-panel-title mb-0">
                Check Registration Status
              </p>
              <p className="registration-status-chatbot-panel-subtitle mb-0">
                Look up your pending or submitted registration
              </p>
            </div>
            <button
              type="button"
              className="registration-status-chatbot-close"
              onClick={() => setOpen(false)}
              aria-label="Close registration status checker"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="registration-status-chatbot-panel-body">
            <RegistrationLookup variant="chatbot" />
          </div>
        </div>
      ) : null}

      <div className="registration-status-chatbot-dock">
        <div
          className={`registration-status-chatbot-tip${tipVisible && !open ? " is-visible" : ""}`}
          aria-hidden={!tipVisible || open}
        >
          {TIP_TEXT}
        </div>
        <button
          type="button"
          className={`registration-status-chatbot-fab${open ? " is-open" : ""}`}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close registration status checker" : "Check registration status"}
        >
          {open ? <CloseIcon /> : <StatusChatIcon />}
        </button>
      </div>
    </div>
  );
}

function StatusChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H12l-3.5 3.2V15H7.5A2.5 2.5 0 0 1 5 12.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9.25" r="1" fill="currentColor" />
      <circle cx="12" cy="9.25" r="1" fill="currentColor" />
      <circle cx="15" cy="9.25" r="1" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
