import type { PaymentStatus } from "@/lib/types/admin";
import { PAYMENT_STATUS_LABELS } from "@/lib/types/admin";

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`admin-status-badge admin-status-badge--${status}`}>
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
