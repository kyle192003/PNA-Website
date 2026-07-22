"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useConfirmAction } from "@/hooks/use-confirm-action";
import { conference } from "@/lib/conference";

const dashboardIcon = (
  <svg className="admin-sidebar-link-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 14V10M8 17V7M12 20V4M16 17V7M20 14V10"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const eventsIcon = (
  <svg className="admin-sidebar-link-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
    <path d="M8 3V7M16 3V7M4 10H20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const participantsIcon = (
  <svg className="admin-sidebar-link-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
    <path
      d="M4 19C4 16.2386 6.23858 14 9 14C11.7614 14 14 16.2386 14 19"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M16 8.5C17.933 8.5 19.5 10.067 19.5 12C19.5 13.933 17.933 15.5 16 15.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M14 19C14.5 16.5 16.5 15 19 15"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const inquiriesIcon = (
  <svg className="admin-sidebar-link-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3 8.25L12 13.5L21 8.25M4.5 19.5H19.5C20.3284 19.5 21 18.8284 21 18V6C21 5.17157 20.3284 4.5 19.5 4.5H4.5C3.67157 4.5 3 5.17157 3 6V18C3 18.8284 3.67157 19.5 4.5 19.5Z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const checkInIcon = (
  <svg className="admin-sidebar-link-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
    <rect x="13" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
    <rect x="4" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
    <path d="M13 16.5H20M16.5 13V20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const settingsIcon = (
  <svg className="admin-sidebar-link-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 8.25A3.75 3.75 0 1 0 12 15.75A3.75 3.75 0 0 0 12 8.25Z"
      stroke="currentColor"
      strokeWidth="1.75"
    />
    <path
      d="M4.5 13.5L3 12L4.5 10.5M19.5 10.5L21 12L19.5 13.5M12 4.5V3M12 21V19.5M7.5 7.5L6.4 6.4M17.6 17.6L16.5 16.5M7.5 16.5L6.4 17.6M17.6 6.4L16.5 7.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const evaluationIcon = (
  <svg className="admin-sidebar-link-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 18V6M8 18V10M12 18V14M16 18V8M20 18V12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const certificateIcon = (
  <svg className="admin-sidebar-link-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
    <path d="M9 9H15M9 13H13M9 17H11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const financialIcon = (
  <svg className="admin-sidebar-link-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 19V5M8 19V10M12 19V7M16 19V12M20 19V9"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const eventSubLinks = [
  { href: "/admin/events", label: "All Events", exact: true },
  { href: "/admin/events/new", label: "Create Event" },
];

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/admin") return [{ label: "Workspace" }, { label: "Dashboard" }];
  if (pathname.startsWith("/admin/events/new")) {
    return [
      { label: "Workspace", href: "/admin" },
      { label: "Events", href: "/admin/events" },
      { label: "Create Event" },
    ];
  }
  if (pathname.match(/^\/admin\/events\/[^/]+/)) {
    return [
      { label: "Workspace", href: "/admin" },
      { label: "Events", href: "/admin/events" },
      { label: "Edit Event" },
    ];
  }
  if (pathname.startsWith("/admin/events")) {
    return [{ label: "Workspace", href: "/admin" }, { label: "Events" }];
  }
  if (pathname.startsWith("/admin/participants")) {
    return [{ label: "Workspace", href: "/admin" }, { label: "Participants" }];
  }
  if (pathname.startsWith("/admin/financial")) {
    return [{ label: "Workspace", href: "/admin" }, { label: "Financial" }];
  }
  if (pathname.startsWith("/admin/check-in")) {
    return [{ label: "Workspace", href: "/admin" }, { label: "Check-In" }];
  }
  if (pathname.startsWith("/admin/evaluation")) {
    return [{ label: "Workspace", href: "/admin" }, { label: "Evaluation" }];
  }
  if (pathname.startsWith("/admin/certificates")) {
    return [{ label: "Workspace", href: "/admin" }, { label: "Certificates" }];
  }
  if (pathname.startsWith("/admin/inquiries")) {
    return [{ label: "Workspace", href: "/admin" }, { label: "Inquiries" }];
  }
  if (pathname.startsWith("/admin/settings")) {
    return [{ label: "Account", href: "/admin" }, { label: "Settings" }];
  }
  return [{ label: "Workspace", href: "/admin" }, { label: "Admin" }];
}

export function AdminShell({
  children,
  initialNewInquiryCount = 0,
  initialUnderReviewCount = 0,
}: {
  children: ReactNode;
  initialNewInquiryCount?: number;
  initialUnderReviewCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newInquiryCount, setNewInquiryCount] = useState(initialNewInquiryCount);
  const [underReviewCount, setUnderReviewCount] = useState(initialUnderReviewCount);

  const breadcrumbs = useMemo(() => getBreadcrumbs(pathname), [pathname]);

  const refreshNewInquiryCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/inquiries/count");
      if (!res.ok) return;

      const data = await res.json();
      setNewInquiryCount(data.newCount ?? 0);
    } catch {
      // Ignore transient fetch errors in the sidebar badge.
    }
  }, []);

  const refreshUnderReviewCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/participants/count");
      if (!res.ok) return;

      const data = await res.json();
      setUnderReviewCount(data.underReviewCount ?? 0);
    } catch {
      // Ignore transient fetch errors in the sidebar badge.
    }
  }, []);

  useEffect(() => {
    setNewInquiryCount(initialNewInquiryCount);
  }, [initialNewInquiryCount]);

  useEffect(() => {
    setUnderReviewCount(initialUnderReviewCount);
  }, [initialUnderReviewCount]);

  useEffect(() => {
    void refreshNewInquiryCount();
    void refreshUnderReviewCount();
  }, [pathname, refreshNewInquiryCount, refreshUnderReviewCount]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    function handleInquiriesUpdated() {
      void refreshNewInquiryCount();
    }

    function handleWindowFocus() {
      void refreshNewInquiryCount();
      void refreshUnderReviewCount();
    }

    window.addEventListener("admin-inquiries-updated", handleInquiriesUpdated);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("admin-inquiries-updated", handleInquiriesUpdated);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [refreshNewInquiryCount, refreshUnderReviewCount]);

  const isDashboardActive = pathname === "/admin";
  const isEventsActive = pathname.startsWith("/admin/events");
  const isParticipantsActive = pathname.startsWith("/admin/participants");
  const isFinancialActive = pathname.startsWith("/admin/financial");
  const isCheckInActive = pathname.startsWith("/admin/check-in");
  const isEvaluationActive = pathname.startsWith("/admin/evaluation");
  const isCertificatesActive = pathname.startsWith("/admin/certificates");
  const isInquiriesActive = pathname.startsWith("/admin/inquiries");
  const isSettingsActive = pathname.startsWith("/admin/settings");

  function handleLogoutClick() {
    requestConfirm({
      title: "Sign out?",
      message: "Are you sure you want to sign out of the admin dashboard?",
      confirmLabel: "Sign out",
      variant: "danger",
      loadingMessage: "Signing out...",
      successTitle: "Signed out",
      successMessage: "You have been signed out successfully.",
      onSuccessClose: () => {
        router.push("/");
        router.refresh();
      },
      action: async () => {
        await fetch("/api/admin/logout", { method: "POST" });
      },
    });
  }

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  return (
    <div className={`admin-shell ${mobileNavOpen ? "admin-shell--nav-open" : ""}`}>
      <LoadingOverlay show={loading} scope="viewport" variant="generic" />
      <ActionConfirmDialogs hook={confirmHook} />

      <button
        type="button"
        className="admin-sidebar-mobile-toggle"
        aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileNavOpen}
        onClick={() => setMobileNavOpen((open) => !open)}
      >
        <MenuIcon open={mobileNavOpen} />
      </button>

      {mobileNavOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={closeMobileNav}
        />
      )}

      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <Link
            href="/admin"
            className="admin-sidebar-brand-mark admin-sidebar-brand-mark--image"
            aria-label={`${conference.siteName} admin home`}
          >
            <Image
              src={conference.logo.src}
              alt=""
              width={40}
              height={40}
              className="pna-brand-logo"
            />
          </Link>
          <div>
            <p className="admin-sidebar-brand-title">{conference.shortName} Admin</p>
            <p className="admin-sidebar-brand-sub">Conference console</p>
          </div>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Admin navigation">
          <p className="admin-sidebar-section">Workspace</p>

          <Link
            href="/admin"
            className={`admin-sidebar-link ${isDashboardActive ? "active" : ""}`}
            onClick={closeMobileNav}
          >
            <span className="admin-sidebar-link-icon">{dashboardIcon}</span>
            <span>Dashboard</span>
          </Link>

          <p className="admin-sidebar-section">Manage</p>

          <div className="admin-sidebar-group">
            <Link
              href="/admin/events"
              className={`admin-sidebar-link ${isEventsActive ? "active" : ""}`}
              onClick={closeMobileNav}
            >
              <span className="admin-sidebar-link-icon">{eventsIcon}</span>
              <span>Events</span>
            </Link>

            {isEventsActive && (
              <div className="admin-sidebar-subnav">
                {eventSubLinks.map((item) => {
                  const subActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`admin-sidebar-sublink ${subActive ? "active" : ""}`}
                      onClick={closeMobileNav}
                    >
                      <span className="admin-sidebar-sublink-dot" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            href="/admin/participants"
            className={`admin-sidebar-link ${isParticipantsActive ? "active" : ""}`}
            onClick={closeMobileNav}
          >
            <span className="admin-sidebar-link-icon">{participantsIcon}</span>
            <span className="admin-sidebar-link-label">
              <span>Participants</span>
              {underReviewCount > 0 && (
                <span
                  className="admin-sidebar-link-badge"
                  aria-label={`${underReviewCount} participants under review`}
                >
                  {underReviewCount > 99 ? "99+" : underReviewCount}
                </span>
              )}
            </span>
          </Link>

          <Link
            href="/admin/financial"
            className={`admin-sidebar-link ${isFinancialActive ? "active" : ""}`}
            onClick={closeMobileNav}
          >
            <span className="admin-sidebar-link-icon">{financialIcon}</span>
            <span>Financial</span>
          </Link>

          <Link
            href="/admin/check-in"
            className={`admin-sidebar-link ${isCheckInActive ? "active" : ""}`}
            onClick={closeMobileNav}
          >
            <span className="admin-sidebar-link-icon">{checkInIcon}</span>
            <span>Check-In</span>
          </Link>

          <Link
            href="/admin/evaluation"
            className={`admin-sidebar-link ${isEvaluationActive ? "active" : ""}`}
            onClick={closeMobileNav}
          >
            <span className="admin-sidebar-link-icon">{evaluationIcon}</span>
            <span>Evaluation</span>
          </Link>

          <Link
            href="/admin/certificates"
            className={`admin-sidebar-link ${isCertificatesActive ? "active" : ""}`}
            onClick={closeMobileNav}
          >
            <span className="admin-sidebar-link-icon">{certificateIcon}</span>
            <span>Certificates</span>
          </Link>

          <Link
            href="/admin/inquiries"
            className={`admin-sidebar-link ${isInquiriesActive ? "active" : ""}`}
            onClick={closeMobileNav}
          >
            <span className="admin-sidebar-link-icon">{inquiriesIcon}</span>
            <span className="admin-sidebar-link-label">
              <span>Inquiries</span>
              {newInquiryCount > 0 && (
                <span
                  className="admin-sidebar-link-badge"
                  aria-label={`${newInquiryCount} new ${newInquiryCount === 1 ? "inquiry" : "inquiries"}`}
                >
                  {newInquiryCount > 99 ? "99+" : newInquiryCount}
                </span>
              )}
            </span>
          </Link>

          <p className="admin-sidebar-section">Account</p>

          <Link
            href="/admin/settings"
            className={`admin-sidebar-link ${isSettingsActive ? "active" : ""}`}
            onClick={closeMobileNav}
          >
            <span className="admin-sidebar-link-icon">{settingsIcon}</span>
            <span>Settings</span>
          </Link>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <span className="admin-sidebar-user-avatar" aria-hidden="true">
              AD
            </span>
            <div className="admin-sidebar-user-copy">
              <p className="admin-sidebar-user-name">Administrator</p>
              <p className="admin-sidebar-user-role">admin</p>
            </div>
          </div>
          <Link href="/" className="admin-sidebar-footer-link" onClick={closeMobileNav}>
            View Site
          </Link>
          <button
            type="button"
            className="admin-sidebar-footer-link admin-sidebar-footer-link--danger"
            onClick={handleLogoutClick}
          >
            Sign Out
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <nav className="admin-topbar-breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <span key={`${crumb.label}-${index}`} className="admin-topbar-crumb">
                  {index > 0 ? <span className="admin-topbar-crumb-sep">›</span> : null}
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className="admin-topbar-crumb-link">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="admin-topbar-crumb-current">{crumb.label}</span>
                  )}
                </span>
              );
            })}
          </nav>
        </header>

        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width={22} height={22} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ) : (
    <svg width={22} height={22} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
