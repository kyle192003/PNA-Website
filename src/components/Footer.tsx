import Image from "next/image";
import Link from "next/link";
import { conference } from "@/lib/conference";
import { FooterNavLinks } from "@/components/FooterNavLinks";

const footerBottomLinks = [
  { href: "/events", label: "Events" },
  { href: "/register", label: "Register" },
  { href: "/contact", label: "Contact" },
] as const;

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="pna-footer">
      <div className="container">
        <div className="pna-footer-top">
          <Link href="/" className="pna-footer-brand">
            <span className="pna-footer-brand-mark pna-footer-brand-mark--image">
              <Image
                src={conference.logo.src}
                alt=""
                width={48}
                height={48}
                className="pna-brand-logo"
              />
            </span>
            <span className="pna-footer-brand-name font-display">{conference.organization}</span>
          </Link>

          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="pna-footer-social"
            aria-label="Philippines Nursing Association on Facebook"
          >
            <FacebookIcon />
          </a>
        </div>

        <div className="pna-footer-divider" aria-hidden="true" />

        <div className="pna-footer-grid">
          <div className="pna-footer-column">
            <h3 className="pna-footer-heading">Secretariat</h3>
            <address className="pna-footer-address">
              {conference.venue.name}
              <br />
              {conference.venue.address}
              <br />
              {conference.venue.city}
            </address>
            <a href={`mailto:${conference.contact.email}`} className="pna-footer-inline-link">
              {conference.contact.email}
            </a>
            <p className="pna-footer-text mb-0">{conference.contact.phone}</p>
            <Link href="/contact" className="pna-footer-location-link">
              <LocationIcon />
              Contact Secretariat
            </Link>
          </div>

          <div className="pna-footer-column">
            <h3 className="pna-footer-heading">Explore</h3>
            <FooterNavLinks />
          </div>

          <div className="pna-footer-column">
            <h3 className="pna-footer-heading">What We Offer</h3>
            <ul className="pna-footer-list">
              {conference.benefits.map((benefit) => (
                <li key={benefit.title}>{benefit.title}</li>
              ))}
            </ul>
          </div>

          <div className="pna-footer-column">
            <h3 className="pna-footer-heading">Registration</h3>
            <ul className="pna-footer-list">
              {Object.values(conference.registration.fees).map((fee) => (
                <li key={fee.label}>{fee.label}</li>
              ))}
            </ul>
            <p className="pna-footer-meta">
              Early bird until {conference.registration.earlyBirdDeadline}
            </p>
            <p className="pna-footer-meta mb-0">
              Regular registration until {conference.registration.regularDeadline}
            </p>
          </div>
        </div>

        <div className="pna-footer-divider" aria-hidden="true" />

        <div className="pna-footer-bottom">
          <p className="pna-footer-copy mb-0">
            Copyright &copy; {currentYear} {conference.organization}. All rights reserved.
          </p>
          <nav className="pna-footer-bottom-nav" aria-label="Footer links">
            {footerBottomLinks.map((link) => (
              <Link key={link.href} href={link.href} className="pna-footer-bottom-link">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 8.5V6.7c0-.8.6-1 1-1h1.6V3h-2.2C12.8 3 11 4.8 11 7.2V8.5H9v2.4h2v7.1h2.5v-7.1H16l.4-2.4h-2.9Z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="11" r="2.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
