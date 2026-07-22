"use client";

import { useEffect, useRef, useState } from "react";

type HeroConferenceVideoProps = {
  src?: string;
  srcWebm?: string;
  poster?: string;
  variant?: "card" | "background";
};

export function HeroConferenceVideo({
  src = "/videos/hero-conference.mp4",
  srcWebm = "/videos/hero-conference.webm",
  poster = "/images/hero-conference-source.jpg",
  variant = "card",
}: HeroConferenceVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  useEffect(() => {
    if (variant !== "background") return;

    const video = videoRef.current;
    if (!video) return;

    const el = video;

    async function tryPlay() {
      try {
        el.muted = true;
        await el.play();
        setVideoPlaying(true);
      } catch {
        setVideoPlaying(false);
      }
    }

    function handlePlaying() {
      setVideoPlaying(true);
    }

    function handlePause() {
      setVideoPlaying(false);
    }

    void tryPlay();

    el.addEventListener("playing", handlePlaying);
    el.addEventListener("pause", handlePause);
    el.addEventListener("canplay", tryPlay);

    return () => {
      el.removeEventListener("playing", handlePlaying);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("canplay", tryPlay);
    };
  }, [variant, src, srcWebm]);

  const video = (
    <video
      ref={variant === "background" ? videoRef : undefined}
      className={
        variant === "background"
          ? `folio-hero-bg-video folio-hero-bg-media${videoPlaying ? " folio-hero-bg-video--playing" : ""}`
          : "folio-hero-video"
      }
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster={poster}
      aria-label="Delegates at a national conference in the Philippines"
      aria-hidden={variant === "background" ? true : undefined}
    >
      <source src={src} type="video/mp4" />
      <source src={srcWebm} type="video/webm" />
    </video>
  );

  if (variant === "background") {
    return (
      <div className="folio-hero-bg" aria-hidden="true">
        <div
          className="folio-hero-bg-poster folio-hero-bg-media"
          style={{ backgroundImage: `url(${poster})` }}
        />
        {video}
        <div className="folio-hero-bg-scrim" />
      </div>
    );
  }

  return <div className="folio-hero-portrait">{video}</div>;
}
