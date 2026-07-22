import { type ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Section({ children, className = "", id }: SectionProps) {
  return (
    <section id={id} className={`folio-section py-4 py-md-5 py-lg-5 ${className}`}>
      <div className="container">{children}</div>
    </section>
  );
}

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  light?: boolean;
}

export function SectionTitle({
  title,
  subtitle,
  centered = false,
  light = false,
}: SectionTitleProps) {
  return (
    <div className={`mb-4 mb-md-5 ${centered ? "text-center" : ""}`}>
      <h2
        className={`folio-split-title font-display ${
          light ? "text-white" : ""
        }`}
      >
        {title}
      </h2>
      <div
        className={`mt-3 rounded-pill ${
          light
            ? "bg-gradient-light-bar mx-auto"
            : `bg-gradient-accent-bar ${centered ? "mx-auto" : ""}`
        }`}
        style={{ height: "4px", width: "5rem" }}
      />
      {subtitle && (
        <p
          className={`mt-4 mb-0 mx-auto leading-relaxed ${
            light ? "text-green-100" : "text-muted"
          }`}
          style={{ maxWidth: centered ? "42rem" : undefined }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
