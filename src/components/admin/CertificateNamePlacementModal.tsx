"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CertificateTemplate } from "@/lib/types/admin";
import { measureFitFontSize } from "@/lib/certificate-name-fit";
import { renderCertificateTemplatePreview } from "@/lib/certificate-template-preview";
import { PnaSelect } from "@/components/ui/PnaSelect";

type PlacementDraft = Pick<
  CertificateTemplate,
  | "namePosXPercent"
  | "namePosYPercent"
  | "nameWidthPercent"
  | "nameHeightPercent"
  | "nameColor"
  | "nameFontWeight"
>;

type DragMode = "move" | "resize-left" | "resize-right" | "resize-top" | "resize-bottom" | null;

const SAMPLE_NAMES = {
  medium: "Participant Name",
  long: "Maria Cristina Delos Santos",
} as const;

export function CertificateNamePlacementModal({
  open,
  fileUrl,
  fileType,
  initial,
  onClose,
  onConfirm,
}: {
  open: boolean;
  fileUrl: string;
  fileType: "image" | "pdf";
  initial: PlacementDraft;
  onClose: () => void;
  onConfirm: (placement: PlacementDraft) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startPlacement: PlacementDraft;
  } | null>(null);

  const [placement, setPlacement] = useState<PlacementDraft>(initial);
  const [previewName, setPreviewName] = useState<string>(SAMPLE_NAMES.medium);
  const [previewFontSize, setPreviewFontSize] = useState(16);
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [backgroundLoading, setBackgroundLoading] = useState(false);

  useEffect(() => {
    if (open) setPlacement(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open || !fileUrl) {
      setBackgroundUrl("");
      return;
    }

    setBackgroundLoading(true);
    void renderCertificateTemplatePreview(fileUrl, fileType)
      .then((dataUrl) => setBackgroundUrl(dataUrl))
      .catch(() => setBackgroundUrl(""))
      .finally(() => setBackgroundLoading(false));
  }, [open, fileUrl, fileType]);

  useLayoutEffect(() => {
    if (!open || !boxRef.current) return;

    const box = boxRef.current.getBoundingClientRect();
    const fontSize = measureFitFontSize(
      previewName,
      box.width,
      box.height,
      placement.nameFontWeight
    );
    setPreviewFontSize(fontSize);
  }, [open, placement, previewName]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const drag = dragRef.current;
    if (!canvas || !drag) return;

    const rect = canvas.getBoundingClientRect();
    const dx = ((clientX - drag.startX) / rect.width) * 100;
    const dy = ((clientY - drag.startY) / rect.height) * 100;
    const start = drag.startPlacement;

    if (drag.mode === "move") {
      setPlacement({
        ...start,
        namePosXPercent: clamp(start.namePosXPercent + dx, 5, 95),
        namePosYPercent: clamp(start.namePosYPercent + dy, 5, 95),
      });
      return;
    }

    if (drag.mode === "resize-left" || drag.mode === "resize-right") {
      const halfDelta = dx / 2;
      const nextWidth =
        drag.mode === "resize-right"
          ? clamp(start.nameWidthPercent + dx, 20, 95)
          : clamp(start.nameWidthPercent - dx, 20, 95);

      setPlacement({
        ...start,
        nameWidthPercent: nextWidth,
        namePosXPercent:
          drag.mode === "resize-right"
            ? clamp(start.namePosXPercent + halfDelta, 5, 95)
            : clamp(start.namePosXPercent - halfDelta, 5, 95),
      });
      return;
    }

    if (drag.mode === "resize-top" || drag.mode === "resize-bottom") {
      const halfDelta = dy / 2;
      const nextHeight =
        drag.mode === "resize-bottom"
          ? clamp(start.nameHeightPercent + dy, 4, 40)
          : clamp(start.nameHeightPercent - dy, 4, 40);

      setPlacement({
        ...start,
        nameHeightPercent: nextHeight,
        namePosYPercent:
          drag.mode === "resize-bottom"
            ? clamp(start.namePosYPercent + halfDelta, 5, 95)
            : clamp(start.namePosYPercent - halfDelta, 5, 95),
      });
    }
  }, []);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      updateFromPointer(event.clientX, event.clientY);
    }

    function handlePointerUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [updateFromPointer]);

  function startDrag(mode: DragMode, event: React.PointerEvent) {
    event.preventDefault();
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startPlacement: placement,
    };
  }

  if (!open) return null;

  const boxStyle = {
    left: `${placement.namePosXPercent}%`,
    top: `${placement.namePosYPercent}%`,
    width: `${placement.nameWidthPercent}%`,
    height: `${placement.nameHeightPercent}%`,
    transform: "translate(-50%, -50%)",
    color: placement.nameColor,
    fontWeight: placement.nameFontWeight,
    fontSize: `${previewFontSize}px`,
  } as const;

  return (
    <div className="cert-placement-modal" role="presentation">
      <button
        type="button"
        className="cert-placement-modal-backdrop"
        aria-label="Close placement editor"
        onClick={onClose}
      />
      <div
        className="cert-placement-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-placement-title"
      >
        <div className="cert-placement-modal-header">
          <div>
            <h2 id="cert-placement-title" className="admin-card-title font-display mb-1">
              Set name placement
            </h2>
            <p className="admin-muted mb-0">
              Drag and resize the box to the name area. Text auto-fits on one line inside the box.
            </p>
          </div>
          <button
            type="button"
            className="admin-login-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="cert-placement-canvas-wrap">
          <div ref={canvasRef} className="cert-placement-canvas">
            {backgroundLoading ? (
              <div className="cert-placement-loading">Loading template preview...</div>
            ) : backgroundUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={backgroundUrl} alt="Certificate template" className="cert-placement-image" />
            ) : (
              <div className="cert-placement-loading">Could not load template preview.</div>
            )}
            <div className="cert-placement-grid" aria-hidden="true" />
            <div
              ref={boxRef}
              className="cert-placement-box"
              style={boxStyle}
              onPointerDown={(event) => startDrag("move", event)}
            >
              <span className="cert-placement-box-label">{previewName}</span>
              <span
                className="cert-placement-handle cert-placement-handle--left"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag("resize-left", event);
                }}
              />
              <span
                className="cert-placement-handle cert-placement-handle--right"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag("resize-right", event);
                }}
              />
              <span
                className="cert-placement-handle cert-placement-handle--top"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag("resize-top", event);
                }}
              />
              <span
                className="cert-placement-handle cert-placement-handle--bottom"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  startDrag("resize-bottom", event);
                }}
              />
            </div>
          </div>
        </div>

        <div className="cert-placement-controls">
          <label className="admin-label">
            Preview name length
            <PnaSelect
              className="admin-select"
              value={previewName}
              onChange={setPreviewName}
              options={[
                { value: SAMPLE_NAMES.medium, label: SAMPLE_NAMES.medium },
                { value: SAMPLE_NAMES.long, label: SAMPLE_NAMES.long },
              ]}
            />
          </label>
          <label className="admin-label">
            Text color
            <input
              type="color"
              className="admin-input"
              value={placement.nameColor}
              onChange={(event) => setPlacement({ ...placement, nameColor: event.target.value })}
            />
          </label>
        </div>

        <p className="admin-muted cert-placement-note mb-0">
          Font size adjusts automatically for each participant so names always stay on one line inside
          the box.
        </p>

        <div className="cert-placement-actions">
          <button type="button" className="btn-pill-arrow btn-pill-arrow--outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => onConfirm(placement)}>
            Save placement
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
