"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Keeps children mounted through a short opacity fade out. */
export function FadeReveal({
  show,
  children,
  className = "",
  durationMs = 280,
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
  durationMs?: number;
}) {
  const [mounted, setMounted] = useState(show);
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), durationMs);
    return () => window.clearTimeout(timeout);
  }, [show, durationMs]);

  if (!mounted) return null;

  return (
    <div
      className={`registration-fade-reveal${visible ? " is-visible" : ""}${
        className ? ` ${className}` : ""
      }`}
      style={{ transitionDuration: `${durationMs}ms` }}
      aria-hidden={!visible}
    >
      {children}
    </div>
  );
}
