"use client";

import Image from "next/image";
import { useEffect } from "react";
import { conference } from "@/lib/conference";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

interface AdminLoginModalProps {
  open: boolean;
  onClose: () => void;
  redirectTo?: string;
}

export function AdminLoginModal({ open, onClose, redirectTo = "/admin" }: AdminLoginModalProps) {
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

  return (
    <div className="admin-login-modal" role="presentation">
      <button
        type="button"
        className="admin-login-modal-backdrop"
        onClick={onClose}
        aria-label="Close admin login"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-login-modal-title"
        className="admin-login-modal-panel"
      >
        <button
          type="button"
          className="admin-login-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <span className="admin-sidebar-brand-mark admin-sidebar-brand-mark--image">
          <Image
            src={conference.logo.src}
            alt={conference.logo.alt}
            width={48}
            height={48}
            className="pna-brand-logo"
          />
        </span>
        <h2 id="admin-login-modal-title" className="font-display admin-login-title">
          Admin Sign In
        </h2>
        <p className="admin-muted mb-4">
          Manage events, payment QR codes, and participant registrations.
        </p>

        <AdminLoginForm onSuccess={onClose} passwordId="admin-password-modal" redirectTo={redirectTo} />
      </div>
    </div>
  );
}
