import dna from "../../../design/pna-design-dna.json";

export const MOTION = dna.design_system.motion;

export const SITE_REVEAL_SECTIONS = ".folio-reveal, .pna-reveal";

/**
 * Leaf/content targets only — avoid wrapper + child pairs that double-animate.
 */
export const SITE_REVEAL_TARGETS = [
  ".folio-eyebrow",
  ".folio-editorial-title",
  ".folio-editorial-lead",
  ".folio-about-stat",
  ".folio-about-actions",
  ".folio-about-media-frame",
  ".folio-about-media-caption",
  ".folio-about-media-desc",
  ".folio-benefit-editorial",
  ".folio-cta-editorial-copy",
  ".folio-cta-editorial-actions",
  ".events-page-group-title",
  ".events-page-group-desc",
  ".events-preview-others-title",
  ".event-card",
  ".event-card--listing",
  ".events-empty",
  ".about-editorial-hero-eyebrow",
  ".about-editorial-hero-title",
  ".about-editorial-hero-lead",
  ".about-editorial-hero-actions",
  ".about-editorial-heading",
  ".about-editorial-text",
  ".about-editorial-theme",
  ".about-editorial-media-frame",
  ".about-editorial-stat-card",
  ".about-editorial-approach-card",
  ".about-editorial-objective-card",
  ".about-editorial-detail-card",
  ".about-editorial-events-lead",
  ".about-editorial-cta-lead",
  ".about-editorial-cta-actions",
  ".about-editorial-eyebrow-light",
  ".btn-editorial",
  ".contact-panel-info",
  ".contact-panel-form",
].join(", ");

export const ADMIN_REVEAL_TARGETS = ".admin-dashboard-card, .admin-card, .pna-admin-reveal";
