import Image from "next/image";
import { conference } from "@/lib/conference";
import { RegisterButton } from "@/components/RegisterButton";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showRegisterCta?: boolean;
  registerEventId?: string;
  /** Optional hero background image. Defaults to the conference poster. */
  imageSrc?: string;
}

export function PageHeader({
  title,
  subtitle,
  showRegisterCta = false,
  registerEventId,
  imageSrc = conference.hero.video.poster,
}: PageHeaderProps) {
  return (
    <section className="about-editorial-hero pna-reveal">
      <div className="about-editorial-hero-media" aria-hidden="true">
        <Image
          src={imageSrc}
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
          <p className="about-editorial-hero-eyebrow">{conference.organization}</p>
          <h1 className="about-editorial-hero-title font-display">{title}</h1>
          {subtitle && <p className="about-editorial-hero-lead">{subtitle}</p>}
          {showRegisterCta && (
            <div className="about-editorial-hero-actions">
              <RegisterButton
                eventId={registerEventId}
                className="btn-editorial btn-editorial--inverse"
                showArrow={false}
              >
                Official Registration
              </RegisterButton>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
