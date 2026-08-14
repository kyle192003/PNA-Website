"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

export function AccountantDocThumb({
  src,
  label,
  isPdf,
}: {
  src: string;
  label: string;
  isPdf: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <figure className="accountant-doc">
        <button
          type="button"
          className="accountant-doc-frame"
          onClick={() => setOpen(true)}
          aria-label={`Zoom ${label}`}
        >
          {isPdf ? (
            <iframe src={src} title={label} className="accountant-doc-iframe" tabIndex={-1} />
          ) : (
            // Native img: authenticated token URLs are not in the Next image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={label} className="accountant-doc-image" />
          )}
        </button>
        <figcaption>
          <button type="button" className="accountant-doc-caption" onClick={() => setOpen(true)}>
            {label} · click to zoom
          </button>
        </figcaption>
      </figure>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        size="overview"
        contentClassName="p-3 sm:p-4"
      >
        <div className="accountant-doc-zoom">
          {isPdf ? (
            <iframe src={src} title={label} className="accountant-doc-zoom-iframe" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={label} className="accountant-doc-zoom-image" />
          )}
        </div>
        <div className="d-flex justify-content-end mt-3">
          <button type="button" className="admin-link-btn" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </Modal>
    </>
  );
}
