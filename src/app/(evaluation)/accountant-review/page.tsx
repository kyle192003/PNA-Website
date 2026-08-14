import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountantReviewPanel } from "@/components/AccountantReviewPanel";

export const metadata: Metadata = {
  title: "Accountant Payment Review",
  description: "Temporary accountant link to review pending participant payments.",
  robots: { index: false, follow: false },
};

export default function AccountantReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="accountant-page">
          <div className="accountant-shell">
            <p className="evaluation-card-desc mb-0">Loading...</p>
          </div>
        </div>
      }
    >
      <AccountantReviewPanel />
    </Suspense>
  );
}
