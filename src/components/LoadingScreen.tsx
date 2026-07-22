"use client";

import { useEffect, useState } from "react";
import { SitePageSkeleton } from "@/components/ui/Skeleton";

const SESSION_KEY = "pna-initial-load-done";
const FADE_MS = 280;
const isDev = process.env.NODE_ENV === "development";

export function LoadingScreen() {
  const [active, setActive] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (isDev || sessionStorage.getItem(SESSION_KEY) === "1") {
      return;
    }

    setActive(true);

    const finish = () => {
      setFadeOut(true);
      window.setTimeout(() => {
        sessionStorage.setItem(SESSION_KEY, "1");
        setActive(false);
      }, FADE_MS);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", finish, { once: true });
      return () => document.removeEventListener("DOMContentLoaded", finish);
    }

    finish();
  }, []);

  if (!active) return null;

  return (
    <div
      className={`pna-loading-screen ${fadeOut ? "pna-loading-screen--hide" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading website"
    >
      <div className="pna-loading-screen-inner">
        <SitePageSkeleton />
      </div>
    </div>
  );
}
