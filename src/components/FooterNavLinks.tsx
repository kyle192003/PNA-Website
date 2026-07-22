"use client";

import Link from "next/link";
import { navLinks } from "@/lib/conference";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useRegistrationModal } from "@/providers/RegistrationProvider";

export function FooterNavLinks() {
  const { openRegistration } = useRegistrationModal();
  const { isAdmin, ready } = useAdminSession();

  return (
    <ul className="pna-footer-list pna-footer-list--links mb-0">
      {navLinks.map((link) => {
        if (link.href === "/register") {
          if (!ready || isAdmin) return null;
          return (
            <li key={link.href}>
              <button
                type="button"
                onClick={() => openRegistration()}
                className="pna-footer-nav-link"
              >
                {link.label}
              </button>
            </li>
          );
        }

        return (
          <li key={link.href}>
            <Link href={link.href} className="pna-footer-nav-link">
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
