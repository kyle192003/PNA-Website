"use client";

import type { ReactNode } from "react";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useRegistrationModal } from "@/providers/RegistrationProvider";

interface RegisterLinkProps {
  children: ReactNode;
  className?: string;
}

export function RegisterLink({
  children,
  className = "text-accent text-decoration-none",
}: RegisterLinkProps) {
  const { openRegistration } = useRegistrationModal();
  const { isAdmin, ready } = useAdminSession();

  if (!ready || isAdmin) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => openRegistration()}
      className={`bg-transparent border-0 p-0 align-baseline ${className}`}
    >
      {children}
    </button>
  );
}
