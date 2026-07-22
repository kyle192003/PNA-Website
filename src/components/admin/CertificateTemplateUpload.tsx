"use client";

import { useCallback, useRef, useState } from "react";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf";

export function CertificateTemplateUpload({
  disabled,
  onUpload,
}: {
  disabled?: boolean;
  onUpload: (file: File) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || disabled) return;
      setSelectedName(file.name);
      void onUpload(file);
    },
    [disabled, onUpload]
  );

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="cert-template-upload">
      <div
        className={`cert-template-upload-dropzone${dragging ? " cert-template-upload-dropzone--active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <div className="cert-template-upload-icon" aria-hidden="true">
          <svg viewBox="0 0 96 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="48" cy="24" rx="30" ry="16" fill="#bfdbfe" />
            <path
              d="M24 52h48l-8-20H32l-8 20z"
              fill="#fbbf24"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            <circle cx="62" cy="50" r="12" fill="#16a34a" />
            <path
              d="M62 44v8M58 48h8"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="cert-template-upload-shapes" aria-hidden="true">
          <span />
          <span />
          <span />
        </p>
      </div>

      <div className="cert-template-upload-copy">
        <h3 className="cert-template-upload-title">Upload Your Certificate Template</h3>
        <p className="cert-template-upload-desc">
          Drag and drop a blank certificate here, or browse your files. Supports PNG, JPG, WebP, and
          PDF up to 10 MB.
        </p>
        {selectedName && (
          <p className="cert-template-upload-filename">
            Selected: <strong>{selectedName}</strong>
          </p>
        )}
      </div>

      <button
        type="button"
        className="cert-template-upload-browse"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Browse Files...
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="cert-template-upload-input"
        disabled={disabled}
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
