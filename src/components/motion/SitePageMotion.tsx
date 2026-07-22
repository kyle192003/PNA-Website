"use client";

import { useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  MOTION,
  SITE_REVEAL_SECTIONS,
  SITE_REVEAL_TARGETS,
} from "@/lib/motion/design-dna-motion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const FADE_Y = Math.round(MOTION.y_offset * 0.65);

function getOutermostTargets(section: HTMLElement): HTMLElement[] {
  const all = Array.from(section.querySelectorAll<HTMLElement>(SITE_REVEAL_TARGETS));
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
}

function setupCinematicHeroTimeline(root: HTMLElement) {
  const hero = root.querySelector(".folio-hero-cinematic");
  if (!hero) return;

  const timeline = gsap.timeline({ defaults: { ease: MOTION.ease_enter } });
  timeline
    .from(hero.querySelector(".folio-hero-cinematic-headline"), {
      opacity: 0,
      y: MOTION.y_offset,
      duration: MOTION.duration_hero_step,
    })
    .from(
      hero.querySelector(".folio-hero-cinematic-tagline"),
      { opacity: 0, y: 16, duration: 0.55 },
      "-=0.35"
    )
    .from(
      hero.querySelector(".folio-hero-cinematic-actions"),
      { opacity: 0, y: 18, duration: 0.55 },
      "-=0.3"
    )
    .from(
      hero.querySelectorAll(".folio-hero-cinematic-bar-list > li"),
      {
        opacity: 0,
        y: 14,
        duration: 0.45,
        stagger: MOTION.stagger,
      },
      "-=0.2"
    );
}

function setupScrollReveals(root: HTMLElement) {
  const sections = gsap.utils.toArray<HTMLElement>(SITE_REVEAL_SECTIONS, root);

  sections.forEach((section) => {
    const targets = getOutermostTargets(section);
    if (!targets.length) return;

    gsap.set(targets, { opacity: 0, y: FADE_Y });

    gsap.to(targets, {
      opacity: 1,
      y: 0,
      duration: MOTION.duration_reveal,
      ease: MOTION.ease_reveal,
      stagger: MOTION.stagger,
      scrollTrigger: {
        trigger: section,
        start: "top 88%",
        once: true,
      },
    });
  });
}

export function SitePageMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(root.querySelectorAll(SITE_REVEAL_TARGETS), {
          clearProps: "all",
          opacity: 1,
          y: 0,
        });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (root.querySelector(".folio-hero-cinematic")) {
          setupCinematicHeroTimeline(root);
        }

        setupScrollReveals(root);
        ScrollTrigger.refresh();
      });

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [pathname], revertOnUpdate: true }
  );

  return (
    <div ref={rootRef} className="pna-page-motion">
      {children}
    </div>
  );
}
