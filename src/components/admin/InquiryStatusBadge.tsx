import type { InquiryStatus } from "@/lib/types/admin";
import { INQUIRY_STATUS_LABELS } from "@/lib/types/admin";

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span className={`admin-status-badge admin-status-badge--${status}`}>
      {INQUIRY_STATUS_LABELS[status]}
    </span>
  );
}
