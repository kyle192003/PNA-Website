"use client";

import { SkeletonContent, type SkeletonVariant } from "@/components/ui/Skeleton";

interface LoadingOverlayProps {
  show: boolean;
  scope?: "viewport" | "local";
  variant?: SkeletonVariant;
}

export function LoadingOverlay({
  show,
  scope = "viewport",
  variant = "generic",
}: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      className={`pna-skeleton-overlay pna-skeleton-overlay--${scope}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading content"
    >
      <SkeletonContent variant={variant} />
    </div>
  );
}
