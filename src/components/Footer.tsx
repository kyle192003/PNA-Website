import Image from "next/image";
import Link from "next/link";

const FOOTER = {
  organization: "Philippine Nurses Association (PNA), Inc.",
  emails: [
    "philippinenursesassociation@yahoo.com.ph",
    "pnanatcon2026@gmail.com",
  ],
  phones: ["(632) 7001 9859", "(0919) 085 7360"],
  address: "1663 F.T. Benitez Street, Malate, Manila, 1004 Philippines",
  website: {
    href: "https://pna-events.com",
    label: "pna-events.com",
  },
  logo: {
    src: "/images/pna-logo.webp",
  },
} as const;

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="pna-footer">
      <div className="container">
        <div className="pna-footer-top">
          <Link href="/" className="pna-footer-brand">
            <span className="pna-footer-brand-mark pna-footer-brand-mark--image">
              <Image
                src={FOOTER.logo.src}
                alt=""
                width={48}
                height={48}
                className="pna-brand-logo"
              />
            </span>
            <span className="pna-footer-brand-name font-display">{FOOTER.organization}</span>
          </Link>

          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="pna-footer-social"
            aria-label="Philippine Nurses Association, Inc. on Facebook"
          >
            <FacebookIcon />
          </a>
        </div>

        <div className="pna-footer-divider" aria-hidden="true" />

        <div className="pna-footer-grid pna-footer-grid--simple">
          <div className="pna-footer-column">
            <h3 className="pna-footer-heading">Contact</h3>
            <p className="pna-footer-contact-line">
              {FOOTER.emails.map((email, index) => (
                <span key={email}>
                  {index > 0 ? " | " : null}
                  <a href={`mailto:${email}`} className="pna-footer-inline-link">
                    {email}
                  </a>
                </span>
              ))}
              {" | "}
              {FOOTER.phones.join(" | ")}
            </p>
            <address className="pna-footer-address">{FOOTER.address}</address>
            <p className="pna-footer-contact-line mb-0">
              Visit our website{" "}
              <a
                href={FOOTER.website.href}
                target="_blank"
                rel="noopener noreferrer"
                className="pna-footer-inline-link"
              >
                {FOOTER.website.label}
              </a>
            </p>
          </div>
        </div>

        <div className="pna-footer-divider" aria-hidden="true" />

        <div className="pna-footer-bottom">
          <p className="pna-footer-copy mb-0">
            Copyright &copy; {currentYear} {FOOTER.organization}. All rights reserved.
          </p>
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
