"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { conference, navLinks } from "@/lib/conference";
import { RegisterButton } from "@/components/RegisterButton";
import { AdminLoginModal } from "@/components/admin/AdminLoginModal";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useRegistrationModal } from "@/providers/RegistrationProvider";

export function Header({
  hideCtas = false,
  forceSolid = false,
  brandOnly = false,
}: {
  hideCtas?: boolean;
  forceSolid?: boolean;
  brandOnly?: boolean;
} = {}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [adminRedirectTo, setAdminRedirectTo] = useState("/admin");
  const [pageScrolled, setPageScrolled] = useState(forceSolid);
  const { isAdmin: adminLoggedIn, ready: adminSessionReady } = useAdminSession();
  const { openRegistration } = useRegistrationModal();
  const headerSolid = forceSolid || pageScrolled || mobileOpen;
  const mainNavLinks = navLinks.filter((link) => link.href !== "/register");
  const leftNavLinks = mainNavLinks.slice(0, 2);
  const rightNavLinks = mainNavLinks.slice(2);
  const showAdminDashboard = adminSessionReady && adminLoggedIn;
  const mobileNavLinks = hideCtas || showAdminDashboard
    ? navLinks.filter((link) => link.href !== "/register")
    : navLinks;

  function handleLogoDoubleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setAdminRedirectTo("/admin");
    setAdminLoginOpen(true);
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  function handleMobileRegister() {
    if (hideCtas || showAdminDashboard) {
      closeMobileMenu();
      return;
    }
    openRegistration();
    closeMobileMenu();
  }

  useEffect(() => {
    closeMobileMenu();
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("pna-mobile-nav-open", mobileOpen);
    return () => document.body.classList.remove("pna-mobile-nav-open");
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobileMenu();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 992px)");

    function handleChange(event: MediaQueryListEvent) {
      if (event.matches) closeMobileMenu();
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (forceSolid) {
      setPageScrolled(true);
      return;
    }

    function handleScroll() {
      setPageScrolled(window.scrollY > 48);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname, forceSolid]);

  return (
    <header
      className={`fixed-top pna-site-header ${headerSolid ? "pna-site-header--scrolled" : ""}`}
    >
      <nav className="pna-navbar pna-navbar--editorial" aria-label="Main navigation">
        <div className="container">
          <div className={`pna-navbar-editorial-shell${brandOnly ? " pna-navbar-editorial-shell--brand-only" : ""}`}>
            {!brandOnly ? (
              <ul className="pna-navbar-editorial-links pna-navbar-editorial-links--left d-none d-lg-flex">
                {leftNavLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`pna-nav-link pna-nav-link--editorial text-decoration-none ${
                        pathname === link.href ? "active" : ""
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            <Link
              href="/"
              className="pna-navbar-editorial-brand text-decoration-none"
              aria-label={`${conference.siteName}, Home`}
            >
              <span
                className="pna-logo-badge pna-logo-badge--admin-trigger pna-logo-badge--editorial pna-logo-badge--image"
                onDoubleClick={handleLogoDoubleClick}
                title={conference.shortName}
              >
                <Image
                  src={conference.logo.src}
                  alt=""
                  width={40}
                  height={40}
                  className="pna-brand-logo"
                  priority
                />
              </span>
              <span className="pna-navbar-editorial-name font-display text-truncate">
                <span className="d-md-none">{conference.shortName}</span>
                <span className="d-none d-md-inline">{conference.organization}</span>
              </span>
            </Link>

            {!brandOnly ? (
              <div className="pna-navbar-editorial-end">
                <ul className="pna-navbar-editorial-links pna-navbar-editorial-links--right d-none d-lg-flex">
                  {rightNavLinks.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={`pna-nav-link pna-nav-link--editorial text-decoration-none ${
                          pathname === link.href ? "active" : ""
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                {!hideCtas ? (
                  showAdminDashboard ? (
                    <Link
                      href="/admin"
                      className={`pna-back-to-dashboard d-none d-lg-inline-flex${
                        headerSolid ? "" : " pna-back-to-dashboard--light"
                      }`}
                    >
                      Back to Dashboard
                    </Link>
                  ) : (
                    <RegisterButton
                      className={`btn-pill-arrow btn-sm-pill d-none d-lg-inline-flex${
                        headerSolid ? "" : " btn-pill-arrow--light"
                      }`}
                    >
                      Register
                    </RegisterButton>
                  )
                ) : null}
                <button
                  type="button"
                  className="pna-navbar-toggler pna-navbar-toggler--editorial d-lg-none"
                  onClick={() => setMobileOpen((open) => !open)}
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileOpen}
                  aria-controls="pna-mobile-nav-drawer"
                >
                  <MenuIcon open={mobileOpen} light={!headerSolid} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      {!brandOnly ? (
        <div
          className={`pna-mobile-nav ${mobileOpen ? "pna-mobile-nav--open" : ""}`}
          aria-hidden={!mobileOpen}
          inert={!mobileOpen ? true : undefined}
        >
          <button
            type="button"
            className="pna-mobile-nav-backdrop"
            onClick={closeMobileMenu}
            aria-label="Close menu"
            tabIndex={mobileOpen ? 0 : -1}
          />
          <div
            id="pna-mobile-nav-drawer"
            className="pna-mobile-nav-drawer"
            role={mobileOpen ? "dialog" : undefined}
            aria-modal={mobileOpen ? true : undefined}
            aria-label="Site menu"
          >
            <div className="pna-mobile-nav-header">
              <div className="d-flex align-items-center gap-2 min-w-0">
                <span className="pna-logo-badge pna-logo-badge--image">
                  <Image
                    src={conference.logo.src}
                    alt={conference.logo.alt}
                    width={36}
                    height={36}
                    className="pna-brand-logo"
                  />
                </span>
                <span className="pna-mobile-nav-title font-display text-truncate">Menu</span>
              </div>
              <button
                type="button"
                className="pna-mobile-nav-close"
                onClick={closeMobileMenu}
                aria-label="Close menu"
                tabIndex={mobileOpen ? 0 : -1}
              >
                <MenuIcon open />
              </button>
            </div>

            <ul className="pna-mobile-nav-list list-unstyled mb-0">
              {mobileNavLinks.map((link) => (
                <li key={link.href}>
                  {link.href === "/register" ? (
                    <button
                      type="button"
                      onClick={handleMobileRegister}
                      tabIndex={mobileOpen ? 0 : -1}
                      className={`pna-mobile-nav-link ${
                        pathname === link.href ? "pna-mobile-nav-link--active" : ""
                      }`}
                    >
                      {link.label}
                    </button>
                  ) : (
                    <Link
                      href={link.href}
                      onClick={closeMobileMenu}
                      tabIndex={mobileOpen ? 0 : -1}
                      className={`pna-mobile-nav-link ${
                        pathname === link.href ? "pna-mobile-nav-link--active" : ""
                      }`}
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            {!hideCtas ? (
              <div className="pna-mobile-nav-footer">
                {showAdminDashboard ? (
                  <Link
                    href="/admin"
                    className="pna-back-to-dashboard pna-back-to-dashboard--mobile"
                    onClick={closeMobileMenu}
                    tabIndex={mobileOpen ? 0 : -1}
                  >
                    Back to Dashboard
                  </Link>
                ) : (
                  <RegisterButton
                    className="btn-pill-arrow w-100 justify-content-center"
                    onClick={closeMobileMenu}
                    tabIndex={mobileOpen ? 0 : -1}
                  >
                    Register Now
                  </RegisterButton>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <AdminLoginModal
        open={adminLoginOpen}
        onClose={() => setAdminLoginOpen(false)}
        redirectTo={adminRedirectTo}
      />
    </header>
  );
}

function MenuIcon({ open, light = false }: { open: boolean; light?: boolean }) {
  const iconClass = light ? "text-white" : "text-accent-deep";
  return open ? (
    <svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor" className={iconClass}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ) : (
    <svg width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor" className={iconClass}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
