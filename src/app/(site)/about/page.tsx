import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RegisterButton } from "@/components/RegisterButton";
import { conference, objectives, attendees } from "@/lib/conference";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="about-editorial-page">
      <section className="about-editorial-hero pna-reveal">
        <div className="about-editorial-hero-media" aria-hidden="true">
          <Image
            src={conference.hero.video.poster}
            alt=""
            fill
            sizes="100vw"
            className="about-editorial-hero-image"
            priority
          />
        </div>
        <div className="about-editorial-hero-scrim" aria-hidden="true" />
        <div className="container">
          <div className="about-editorial-hero-content">
            <h1 className="about-editorial-hero-title font-display">
              {conference.pages.about.title}
            </h1>
            <p className="about-editorial-hero-lead">{conference.pages.about.subtitle}</p>
          </div>
        </div>
      </section>

      <section className="about-editorial-intro pna-reveal">
        <div className="container">
          <div className="about-editorial-split">
            <div className="about-editorial-media">
              <div className="about-editorial-media-frame">
                <Image
                  src={conference.hero.video.poster}
                  alt="Delegates at the Philippines Nursing Association national conference"
                  fill
                  sizes="(min-width: 992px) 46vw, 100vw"
                  className="about-editorial-media-image"
                />
              </div>
            </div>
            <div className="about-editorial-copy">
              <p className="folio-eyebrow folio-eyebrow--caps">Who We Are</p>
              <h2 className="about-editorial-heading font-display">
                A National Forum for Professional Excellence
              </h2>
              <p className="about-editorial-text">{conference.about.summary}</p>
              <p className="about-editorial-text">{conference.about.mission}</p>
              <p className="about-editorial-theme font-display">
                &ldquo;{conference.theme}&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="about-editorial-stats pna-reveal">
        <div className="container">
          <div className="about-editorial-section-head">
            <p className="folio-eyebrow folio-eyebrow--caps mb-0">Conference Impact</p>
            <h2 className="about-editorial-heading font-display mb-0">
              Numbers That Define the Program
            </h2>
          </div>
          <div className="about-editorial-stats-grid">
            {conference.stats.map((stat) => (
              <article className="about-editorial-stat-card" key={stat.label}>
                <p className="about-editorial-stat-value font-display">{stat.value}</p>
                <h3 className="about-editorial-stat-label">{stat.label}</h3>
                <p className="about-editorial-stat-desc">
                  Anticipated scale of the {conference.conferenceName}.
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-editorial-approach pna-reveal">
        <div className="container">
          <div className="about-editorial-section-head about-editorial-section-head--light">
            <p className="about-editorial-eyebrow-light mb-0">Our Approach</p>
            <h2 className="about-editorial-heading about-editorial-heading--light font-display mb-0">
              What Sets This Conference Apart
            </h2>
          </div>
          <div className="about-editorial-approach-grid">
            {conference.benefits.map((benefit) => (
              <article className="about-editorial-approach-card" key={benefit.title}>
                <h3 className="about-editorial-approach-title">{benefit.title}</h3>
                <p className="about-editorial-approach-text">{benefit.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-editorial-objectives pna-reveal">
        <div className="container">
          <div className="about-editorial-section-head">
            <p className="folio-eyebrow folio-eyebrow--caps mb-0">Program Objectives</p>
            <h2 className="about-editorial-heading font-display mb-3">
              Institutional Goals for 2026
            </h2>
            <p className="about-editorial-text mb-0">
              The {conference.conferenceName} is structured to achieve the following objectives.
            </p>
          </div>
          <div className="about-editorial-objectives-grid">
            {objectives.map((objective) => (
              <article className="about-editorial-objective-card" key={objective.title}>
                <h3 className="about-editorial-objective-title font-display">{objective.title}</h3>
                <p className="about-editorial-objective-text">{objective.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-editorial-details pna-reveal">
        <div className="container">
          <div className="about-editorial-details-grid">
            <article className="about-editorial-detail-card">
              <p className="folio-eyebrow folio-eyebrow--caps">Venue &amp; Schedule</p>
              <h2 className="about-editorial-detail-title font-display">{conference.venue.name}</h2>
              <p className="about-editorial-text">{conference.venue.address}</p>
              <p className="about-editorial-text">{conference.venue.city}</p>
              <dl className="about-editorial-detail-meta">
                <div>
                  <dt>Official Dates</dt>
                  <dd>{conference.dates.display}</dd>
                </div>
                <div>
                  <dt>Registration Hours</dt>
                  <dd>08:00 AM daily</dd>
                </div>
                <div>
                  <dt>Attire</dt>
                  <dd>Business / Business Casual</dd>
                </div>
              </dl>
            </article>
            <article className="about-editorial-detail-card">
              <p className="folio-eyebrow folio-eyebrow--caps">Intended Participants</p>
              <h2 className="about-editorial-detail-title font-display">Who Should Attend</h2>
              <ul className="about-editorial-participants-list">
                {attendees.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="about-editorial-events-cta pna-reveal">
        <div className="container about-editorial-events-cta-inner">
          <p className="about-editorial-eyebrow-light mb-0">Conference Calendar</p>
          <h2 className="about-editorial-heading about-editorial-heading--light font-display">
            Explore Upcoming Programs
          </h2>
          <p className="about-editorial-events-lead">
            Browse open registrations and upcoming events hosted by the {conference.organization}.
          </p>
          <Link href="/events" className="btn-editorial btn-editorial--inverse">
            View All Events
          </Link>
        </div>
      </section>

      <section className="about-editorial-cta pna-reveal">
        <div className="container about-editorial-cta-inner">
          <h2 className="about-editorial-heading about-editorial-heading--light font-display">
            Ready to Join the {conference.conferenceName}?
          </h2>
          <p className="about-editorial-cta-lead">
            Secure your participation before the early registration deadline on{" "}
            {conference.registration.earlyBirdDeadline}. Contact the secretariat for official
            inquiries.
          </p>
          <div className="about-editorial-cta-actions">
            <RegisterButton className="btn-editorial btn-editorial--inverse" showArrow={false}>
              Proceed to Registration
            </RegisterButton>
            <Link href="/contact" className="btn-editorial btn-editorial--inverse-outline">
              Contact the Secretariat
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
