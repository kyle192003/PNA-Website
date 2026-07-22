import type { CSSProperties, HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  style?: CSSProperties;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return <div className={`pna-skeleton ${className}`.trim()} aria-hidden="true" {...props} />;
}

export function SkeletonText({
  width = "100%",
  className = "",
}: {
  width?: string | number;
  className?: string;
}) {
  return <Skeleton className={`pna-skeleton-text ${className}`.trim()} style={{ width }} />;
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="pna-skeleton-table" aria-hidden="true">
      <div className="pna-skeleton-table-head">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={`head-${index}`} className="pna-skeleton-table-cell" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="pna-skeleton-table-row">
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="pna-skeleton-table-cell" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="pna-skeleton-form" aria-hidden="true">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="pna-skeleton-form-field">
          <Skeleton className="pna-skeleton-form-label" />
          <Skeleton className="pna-skeleton-form-input" />
        </div>
      ))}
      <Skeleton className="pna-skeleton-form-button" />
    </div>
  );
}

export function GenericSkeleton() {
  return (
    <div className="pna-skeleton-stack" aria-hidden="true">
      <Skeleton className="pna-skeleton-block pna-skeleton-block--lg" />
      <Skeleton className="pna-skeleton-block" />
      <Skeleton className="pna-skeleton-block" />
      <Skeleton className="pna-skeleton-block pna-skeleton-block--sm" />
    </div>
  );
}

export function LookupResultSkeleton() {
  return (
    <div className="pna-skeleton-lookup" aria-hidden="true">
      <Skeleton className="pna-skeleton-lookup-title" />
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="pna-skeleton-lookup-row">
          <Skeleton className="pna-skeleton-lookup-label" />
          <Skeleton className="pna-skeleton-lookup-value" />
        </div>
      ))}
    </div>
  );
}

export function QrPanelSkeleton() {
  return (
    <div className="pna-skeleton-qr" aria-hidden="true">
      <Skeleton className="pna-skeleton-qr-image" />
      <Skeleton className="pna-skeleton-qr-link" />
      <div className="pna-skeleton-qr-actions">
        <Skeleton className="pna-skeleton-qr-action" />
        <Skeleton className="pna-skeleton-qr-action" />
      </div>
    </div>
  );
}

export function SitePageSkeleton() {
  return (
    <div className="pna-skeleton-site" aria-hidden="true">
      <Skeleton className="pna-skeleton-site-header" />
      <div className="pna-skeleton-site-hero">
        <Skeleton className="pna-skeleton-site-title" />
        <Skeleton className="pna-skeleton-site-subtitle" />
        <Skeleton className="pna-skeleton-site-button" />
      </div>
      <div className="pna-skeleton-site-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="pna-skeleton-site-card" />
        ))}
      </div>
    </div>
  );
}

export function AdminEditPageSkeleton() {
  return (
    <div className="admin-page">
      <div className="pna-skeleton-stack mb-4">
        <Skeleton className="pna-skeleton-block pna-skeleton-block--title" />
        <Skeleton className="pna-skeleton-block pna-skeleton-block--sm" style={{ width: "42%" }} />
      </div>

      <div className="admin-edit-grid">
        <div className="admin-card p-4">
          <FormSkeleton fields={8} />
        </div>
        <div className="admin-edit-grid__qr-row">
          <div className="admin-card p-4">
            <QrPanelSkeleton />
          </div>
          <div className="admin-card p-4">
            <QrPanelSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

export type SkeletonVariant =
  | "generic"
  | "form"
  | "table"
  | "lookup"
  | "qr"
  | "page"
  | "site";

export function SkeletonContent({ variant = "generic" }: { variant?: SkeletonVariant }) {
  switch (variant) {
    case "form":
      return <FormSkeleton />;
    case "table":
      return <TableSkeleton />;
    case "lookup":
      return <LookupResultSkeleton />;
    case "qr":
      return <QrPanelSkeleton />;
    case "page":
      return <AdminEditPageSkeleton />;
    case "site":
      return <SitePageSkeleton />;
    default:
      return <GenericSkeleton />;
  }
}
