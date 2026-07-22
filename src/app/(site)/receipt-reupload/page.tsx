import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { ReceiptReuploadForm } from "@/components/ReceiptReuploadForm";

export const metadata: Metadata = {
  title: "Reupload Payment Receipt",
  description: "Confirm your registration details and upload a clearer payment receipt.",
};

export default function ReceiptReuploadPage() {
  return (
    <>
      <PageHeader
        title="Reupload Payment Receipt"
        subtitle="Your registration details are still on file. Confirm your name and upload a clearer receipt for review."
      />
      <Section className="folio-section--white pt-4 pb-5">
        <div className="row justify-content-center">
          <div className="col-lg-7">
            <Suspense fallback={<p className="text-muted">Loading...</p>}>
              <ReceiptReuploadForm />
            </Suspense>
          </div>
        </div>
      </Section>
    </>
  );
}
