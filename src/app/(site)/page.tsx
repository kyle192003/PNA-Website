import Link from "next/link";
import Image from "next/image";
import { conference } from "@/lib/conference";
import { Section } from "@/components/Section";
import { RegisterButton } from "@/components/RegisterButton";
import { EventsPreview } from "@/components/EventsPreview";
import { HeroConferenceVideo } from "@/components/HeroConferenceVideo";
import { getHomepageEvents } from "@/lib/events";

export default async function HomePage() {
  const { featured, others } = await getHomepageEvents();

  return (
    <div className="folio-page folio-page--editorial">
        <section className="folio-hero-cinematic">
          <HeroConferenceVideo
            variant="background"
            src={conference.hero.video.src}
            srcWebm={conference.hero.video.srcWebm}
            poster={conference.hero.video.poster}
          />

          <div className="folio-hero-cinematic-inner">
            <div className="folio-hero-cinematic-brand">
              <h1 className="folio-hero-cinematic-headline font-display">{conference.hero.headline}</h1>
              <p className="folio-hero-cinematic-tagline">
                {conference.conferenceName}
                <span className="folio-hero-cinematic-dot" aria-hidden="true">
                  {" "}
                  ·{" "}
                </span>
                {conference.dates.display}
              </p>
              <div className="folio-hero-cinematic-actions">
                <RegisterButton className="btn-editorial" showArrow={false}>
                  Register Now
                </RegisterButton>
                <Link href="/events" className="btn-editorial btn-editorial--ghost">
                  View Events
                </Link>
              </div>
            </div>
          </div>

          <div className="folio-hero-cinematic-bar">
            <div className="container">
              <ul className="folio-hero-cinematic-bar-list">
                <li>
                  <span className="folio-hero-cinematic-bar-label">Dates</span>
                  <span className="folio-hero-cinematic-bar-value">{conference.dates.display}</span>
                </li>
                <li>
                  <span className="folio-hero-cinematic-bar-label">Venue</span>
                  <span className="folio-hero-cinematic-bar-value">{conference.venue.name}</span>
                </li>
                <li>
                  <span className="folio-hero-cinematic-bar-label">Early Bird</span>
                  <span className="folio-hero-cinematic-bar-value">
                    {conference.registration.earlyBirdDeadline}
                  </span>
                </li>
                <li>
                  <span className="folio-hero-cinematic-bar-label">Status</span>
                  <span className="folio-hero-cinematic-bar-value">Registration Open</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <Section className="folio-section--white folio-reveal pt-5 pt-lg-5">
          <div className="folio-about-editorial">
            <div className="folio-about-copy">
              <p className="folio-eyebrow folio-eyebrow--caps">Institutional Mandate</p>
              <h2 className="folio-editorial-title font-display">
                A National Forum for Professional Excellence
              </h2>
              <p className="folio-editorial-lead">{conference.about.summary}</p>

              <div className="folio-about-stats">
                {conference.stats.map((stat) => (
                  <div className="folio-about-stat" key={stat.label}>
                    <p className="folio-about-stat-value font-display">{stat.value}</p>
                    <p className="folio-about-stat-label">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="folio-about-actions">
                <Link href="/about" className="btn-editorial">
                  Read Full Overview
                </Link>
                <RegisterButton className="btn-editorial btn-editorial--outline" showArrow={false}>
                  Register Now
                </RegisterButton>
              </div>
            </div>

            <div className="folio-about-media">
              <div className="folio-about-media-frame">
                <Image
                  src={conference.hero.video.poster}
                  alt="Conference delegates at the Philippine International Convention Center"
                  fill
                  sizes="(min-width: 992px) 44vw, 100vw"
                  className="folio-about-media-image"
                  priority
                />
              </div>
              <p className="folio-about-media-caption font-display">
                &ldquo;{conference.theme}&rdquo;
              </p>
              <p className="folio-about-media-desc">{conference.hero.description}</p>
            </div>
          </div>

          <div className="folio-benefits-editorial">
            {conference.benefits.map((benefit) => (
              <article className="folio-benefit-editorial" key={benefit.title}>
                <h3 className="folio-benefit-editorial-title font-display">{benefit.title}</h3>
                <p className="folio-benefit-editorial-text">{benefit.description}</p>
              </article>
            ))}
          </div>
        </Section>

        <div className="folio-reveal">
          <EventsPreview featured={featured} others={others} />
        </div>

        <Section className="folio-section--white folio-reveal pb-5 pb-lg-5">
          <div className="folio-cta-editorial">
            <div className="folio-cta-editorial-copy">
              <h2 className="folio-editorial-title font-display mb-3">{conference.cta.title}</h2>
              <p className="folio-editorial-lead mb-0">
                {conference.cta.description.replace(
                  "{earlyBirdDeadline}",
                  conference.registration.earlyBirdDeadline
                )}
              </p>
            </div>
            <div className="folio-cta-editorial-actions">
              <RegisterButton className="btn-editorial" showArrow={false}>
                Proceed to Registration
              </RegisterButton>
              <Link href="/contact" className="btn-editorial btn-editorial--outline">
                Contact Secretariat
              </Link>
            </div>
          </div>
        </Section>
      </div>
  );
}
