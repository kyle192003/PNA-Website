"use client";

import { useEffect, useState } from "react";
import { renderPdfPageToDataUrl } from "@/lib/certificate-template-preview";

export function CertificateGeneratedPreview({
  imageDataUrl,
  pdfDataUrl,
}: {
  imageDataUrl?: string;
  pdfDataUrl?: string;
}) {
  const [renderedImage, setRenderedImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (imageDataUrl) {
      setRenderedImage(imageDataUrl);
      setError(null);
      setLoading(false);
      return;
    }

    if (!pdfDataUrl) {
      setRenderedImage("");
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    void renderPdfPageToDataUrl(pdfDataUrl)
      .then((dataUrl) => {
        setRenderedImage(dataUrl);
      })
      .catch(() => {
        setError("Could not render PDF preview.");
        setRenderedImage("");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [imageDataUrl, pdfDataUrl]);

  if (loading) {
    return <p className="admin-muted mb-0">Generating preview...</p>;
  }

  if (error) {
    return <p className="admin-alert admin-alert--error mb-0">{error}</p>;
  }

  if (!renderedImage) {
    return (
      <p className="admin-muted mb-0">
        Upload a certificate template (image or PDF) to preview the generated certificate.
      </p>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={renderedImage}
      alt="Generated certificate preview"
      className="admin-certificates-image-preview-img"
    />
  );
}
