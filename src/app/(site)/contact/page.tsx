import type { Metadata } from "next";
import Image from "next/image";
import { ContactInquiryForm } from "@/components/ContactInquiryForm";
import { conference } from "@/lib/conference";
import { getHomepageEvents } from "@/lib/events";
import { resolveEventVenueDisplay } from "@/lib/event-utils";

export const metadata: Metadata = {
  title: "Contact",
};

export const dynamic = "force-dynamic";

const socialLinks = [
  {
    label: "LinkedIn",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6.5 8.5h3v9h-3v-9Zm1.5-4.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5ZM10 8.5h2.9v1.23h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.6v4.73h-3v-4.2c0-1 0-2.28-1.39-2.28-1.39 0-1.6 1.09-1.6 2.21v4.27H10V8.5Z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M14.5 8.5H17V5.5h-2.5c-2.4 0-3.9 1.46-3.9 3.78V11H8.5v3h2.1v7h3.1v-7h2.6l.4-3h-3V9.2c0-.86.23-1.2 1.45-1.2Z" />
      </svg>
    ),
  },
  {
    label: "Twitter",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.9 7.5c.01.14.01.28.01.42 0 4.28-3.26 9.22-9.22 9.22-1.83 0-3.54-.53-4.99-1.45.26.03.51.04.78.04 1.52 0 2.92-.52 4.03-1.39a3.26 3.26 0 0 1-3.04-2.26c.2.04.4.06.61.06.29 0 .58-.04.85-.11a3.25 3.25 0 0 1-2.6-3.19v-.04c.45.25.97.4 1.52.42a3.24 3.24 0 0 1-1-4.33 9.22 9.22 0 0 0 6.69 3.39 3.24 3.24 0 0 1 5.53-2.95 6.48 6.48 0 0 0 2.06-.79 3.26 3.26 0 0 1-1.43 1.8 6.52 6.52 0 0 0 1.87-.51 7.02 7.02 0 0 1-1.63 1.69Z" />
      </svg>
    ),
  },
];

const SECRETARIAT_CONTACT = {
  emails: [
    "philippinenursesassociation@yahoo.com.ph",
    "pnanatcon2026@gmail.com",
  ],
  phones: ["(632) 7001 9859", "(0919) 085 7360"],
} as const;

export default async function ContactPage() {
  const { featured } = await getHomepageEvents();
  const venue = resolveEventVenueDisplay(featured);

  return (
    <div className="contact-page">
      <section className="about-editorial-hero about-editorial-hero--compact pna-reveal">
        <div className="about-editorial-hero-media" aria-hidden="true">
          <Image
            src="/images/registration.JPG"
            alt=""
            fill
            sizes="100vw"
            className="about-editorial-hero-image about-editorial-hero-image--flip-x"
            priority
          />
        </div>
        <div className="about-editorial-hero-scrim" aria-hidden="true" />
        <div className="container">
          <div className="about-editorial-hero-content">
            <p className="about-editorial-hero-eyebrow">{conference.organization}</p>
            <h1 className="about-editorial-hero-title font-display">
              {conference.pages.contact.title}
            </h1>
            <p className="about-editorial-hero-lead">{conference.pages.contact.subtitle}</p>
          </div>
        </div>
      </section>

      <div className="container pna-reveal">
        <div className="contact-panel">
          <div className="contact-panel-grid">
            <div className="contact-panel-info">
              <h1 className="contact-panel-title font-display">Let&apos;s Talk</h1>
              <p className="contact-panel-lead">
                Have a question or want to discuss conference participation? Reach out using the
                form and our secretariat will respond as soon as possible.
              </p>

              <div className="contact-panel-details">
                <p>{venue.name}</p>
                <p>{venue.address}</p>
                {venue.city ? <p>{venue.city}</p> : null}
                {SECRETARIAT_CONTACT.emails.map((email) => (
                  <a key={email} href={`mailto:${email}`} className="contact-panel-email">
                    {email}
                  </a>
                ))}
                <p className="contact-panel-phone mb-0">
                  {SECRETARIAT_CONTACT.phones.map((phone, index) => (
                    <span key={phone}>
                      {index > 0 ? " | " : null}
                      <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="contact-panel-email">
                        {phone}
                      </a>
                    </span>
                  ))}
                </p>
              </div>

              <div className="contact-social" aria-label="Social media links">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="contact-social-link"
                    aria-label={link.label}
                  >
                    {link.icon}
                  </a>
                ))}
              </div>
            </div>

            <div className="contact-panel-form">
              <ContactInquiryForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
