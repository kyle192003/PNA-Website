import { Suspense } from "react";
import type { Metadata } from "next";
import { ReceiptReuploadForm } from "@/components/ReceiptReuploadForm";

export const metadata: Metadata = {
  title: "Reupload Payment Receipt",
  description: "Confirm your registration details and upload a clearer payment receipt.",
};

export default function ReceiptReuploadPage() {
  return (
    <Suspense
      fallback={
        <div className="evaluation-page">
          <div className="evaluation-card">
            <p className="evaluation-card-desc mb-0">Loading...</p>
          </div>
        </div>
      }
    >
      <ReceiptReuploadForm />
    </Suspense>
  );
}
