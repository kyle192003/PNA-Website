import { Suspense } from "react";
import type { Metadata } from "next";
import { InquiryShareReplyForm } from "@/components/InquiryShareReplyForm";

export const metadata: Metadata = {
  title: "Reply to Inquiry",
  description: "Submit a one-time reply to a shared PNA inquiry.",
  robots: { index: false, follow: false },
};

export default async function InquiryShareShortLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

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
      <InquiryShareReplyForm code={code} />
    </Suspense>
  );
}
