"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useRegistrationModal } from "@/providers/RegistrationProvider";
import { PillArrowIcon } from "@/components/ui/PillArrow";

interface RegisterButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
  showArrow?: boolean;
  eventId?: string;
  /** Show on event cards/modals even when an admin session is active. */
  alwaysShow?: boolean;
}

export function RegisterButton({
  children,
  className = "btn-pill-arrow",
  showArrow = true,
  eventId,
  alwaysShow = false,
  onClick,
  ...props
}: RegisterButtonProps) {
  const { openRegistration } = useRegistrationModal();
  const { isAdmin, ready } = useAdminSession();

  if (!alwaysShow && (!ready || isAdmin)) {
    return null;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          openRegistration(eventId);
        }
      }}
      {...props}
    >
      {children}
      {showArrow && (
        <span className="btn-pill-arrow-icon" aria-hidden="true">
          <PillArrowIcon />
        </span>
      )}
    </button>
  );
}
