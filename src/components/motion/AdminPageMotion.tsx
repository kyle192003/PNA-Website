"use client";

import { useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ADMIN_REVEAL_TARGETS, MOTION } from "@/lib/motion/design-dna-motion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const ADMIN_Y = Math.round(MOTION.y_offset * 0.65);
const ADMIN_DURATION = MOTION.duration_reveal * 0.75;

export function AdminPageMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(root.querySelectorAll(ADMIN_REVEAL_TARGETS), {
          clearProps: "all",
          opacity: 1,
          y: 0,
        });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(root.querySelectorAll(".admin-dashboard-header > *, .admin-page-header > *"), {
          opacity: 0,
          y: ADMIN_Y,
          duration: ADMIN_DURATION,
          ease: MOTION.ease_enter,
          stagger: 0.08,
        });

        gsap.utils.toArray<HTMLElement>(ADMIN_REVEAL_TARGETS, root).forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: ADMIN_Y,
            duration: ADMIN_DURATION,
            ease: MOTION.ease_reveal,
            immediateRender: false,
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          });
        });

        ScrollTrigger.refresh();
      });

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [pathname], revertOnUpdate: true }
  );

  return (
    <div ref={rootRef} className="pna-admin-motion">
      {children}
    </div>
  );
}
