"use client";

import dynamic from "next/dynamic";

const ParticleBackground = dynamic(
  () => import("@/components/three/ParticleBackground").then((mod) => mod.ParticleBackground),
  { ssr: false }
);

export function HeroParticleBackground({ particleCount = 80 }: { particleCount?: number }) {
  return <ParticleBackground particleCount={particleCount} />;
}
