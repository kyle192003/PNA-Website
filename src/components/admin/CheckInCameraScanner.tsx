"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type CheckInCameraScannerProps = {
  onScan: (decodedText: string) => void;
  disabled?: boolean;
};

export function CheckInCameraScanner({ onScan, disabled = false }: CheckInCameraScannerProps) {
  const reactId = useId();
  const readerId = `check-in-qr-reader-${reactId.replace(/:/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const runningRef = useRef(false);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const onScanRef = useRef(onScan);
  const disabledRef = useRef(disabled);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      runningRef.current = false;
      setActive(false);
      return;
    }

    try {
      if (runningRef.current || scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // Scanner may already be stopped.
    }

    try {
      scanner.clear();
    } catch {
      // Ignore clear errors after stop.
    }

    runningRef.current = false;
    scannerRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    if (starting || runningRef.current) return;

    setCameraError(null);
    setStarting(true);

    try {
      await stopCamera();

      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;

      const boxSize = Math.min(280, Math.floor(window.innerWidth * 0.7));

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 8,
          qrbox: { width: boxSize, height: boxSize },
          aspectRatio: 1,
        },
        (decodedText) => {
          if (disabledRef.current) return;

          const now = Date.now();
          const last = lastScanRef.current;
          if (last && last.value === decodedText && now - last.at < 3500) {
            return;
          }
          lastScanRef.current = { value: decodedText, at: now };
          onScanRef.current(decodedText);
        },
        () => {
          // Per-frame miss — ignore.
        }
      );

      runningRef.current = true;
      setActive(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to open the camera.";
      setCameraError(
        /NotAllowedError|Permission|denied/i.test(message)
          ? "Camera permission was denied. Allow camera access in your browser settings, then try again."
          : /NotFoundError|DevicesNotFound/i.test(message)
            ? "No camera was found on this device."
            : "Unable to open the camera. Use HTTPS (or localhost) and try again."
      );
      await stopCamera();
    } finally {
      setStarting(false);
    }
  }, [starting, readerId, stopCamera]);

  return (
    <div className="admin-check-in-camera">
      <div className="admin-check-in-camera-header">
        <div>
          <h2 className="admin-card-title font-display mb-1">Camera scan</h2>
          <p className="admin-muted mb-0">
            Open your phone camera and point it at the participant&apos;s check-in QR code.
          </p>
        </div>
        <div className="admin-check-in-camera-controls">
          {!active ? (
            <button
              type="button"
              className="btn-pill-arrow"
              onClick={() => void startCamera()}
              disabled={starting}
            >
              {starting ? "Opening camera…" : "Open camera"}
            </button>
          ) : (
            <button
              type="button"
              className="btn-pill-arrow btn-pill-arrow--outline"
              onClick={() => void stopCamera()}
            >
              Stop camera
            </button>
          )}
        </div>
      </div>

      {cameraError && (
        <p className="admin-check-in-camera-error" role="alert">
          {cameraError}
        </p>
      )}

      <div
        id={readerId}
        className={`admin-check-in-camera-viewport ${active ? "is-active" : ""}`}
        aria-live="polite"
      />

      {!active && !starting && (
        <p className="admin-muted admin-check-in-camera-hint mb-0">
          Tip: on phones, use the rear camera and hold the QR steady inside the frame.
        </p>
      )}
    </div>
  );
}
