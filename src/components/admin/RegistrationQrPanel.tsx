"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ConferenceEvent } from "@/lib/types/admin";
import { buildRegistrationQrDetails } from "@/lib/registration-qr-urls";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { QrPanelSkeleton } from "@/components/ui/Skeleton";
import { useConfirmAction } from "@/hooks/use-confirm-action";

interface RegistrationQrDetails {
  registrationUrl: string;
  qrCodeUrl: string;
  quickChartUrl: string;
}

function getInitialDetails(event: ConferenceEvent): RegistrationQrDetails | null {
  if (!event.registrationQrCodeUrl) return null;

  return buildRegistrationQrDetails(
    event.id,
    event.title,
    event.registrationQrCodeUrl
  );
}

export function RegistrationQrPanel({
  event,
  onUpdated,
}: {
  event: ConferenceEvent;
  onUpdated: (event: ConferenceEvent) => void;
}) {
  const [details, setDetails] = useState<RegistrationQrDetails | null>(() =>
    getInitialDetails(event)
  );
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;
  const onUpdatedRef = useRef(onUpdated);
  onUpdatedRef.current = onUpdated;

  const syncDetailsFromEvent = useCallback((nextEvent: ConferenceEvent) => {
    if (!nextEvent.registrationQrCodeUrl) {
      setDetails(null);
      return;
    }

    setDetails(
      buildRegistrationQrDetails(
        nextEvent.id,
        nextEvent.title,
        nextEvent.registrationQrCodeUrl
      )
    );
  }, []);

  useEffect(() => {
    syncDetailsFromEvent(event);
  }, [event.id, event.title, event.registrationQrCodeUrl, syncDetailsFromEvent]);

  useEffect(() => {
    if (event.registrationQrCodeUrl) return;

    let cancelled = false;

    async function generateMissingQr() {
      setGenerating(true);
      setError("");

      try {
        const res = await fetch(`/api/admin/events/${event.id}/registration-qr`, {
          method: "POST",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to generate registration QR code.");
        }

        if (cancelled) return;

        setDetails({
          registrationUrl: data.registrationUrl,
          qrCodeUrl: data.qrCodeUrl,
          quickChartUrl: data.quickChartUrl,
        });

        if (data.event) {
          onUpdatedRef.current(data.event);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to generate registration QR code.");
        }
      } finally {
        if (!cancelled) {
          setGenerating(false);
        }
      }
    }

    generateMissingQr();

    return () => {
      cancelled = true;
    };
  }, [event.id, event.registrationQrCodeUrl]);

  function handleRegenerate() {
    requestConfirm({
      title: "Regenerate registration QR?",
      message:
        "This will create a new pubmat QR code for this event using the current registration link.",
      confirmLabel: "Regenerate QR",
      loadingMessage: "Generating QR code...",
      successTitle: "QR code regenerated",
      successMessage: "The registration QR code was updated successfully.",
      action: async () => {
        const res = await fetch(`/api/admin/events/${event.id}/registration-qr`, {
          method: "POST",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to regenerate registration QR code.");
        }

        setDetails({
          registrationUrl: data.registrationUrl,
          qrCodeUrl: data.qrCodeUrl,
          quickChartUrl: data.quickChartUrl,
        });

        if (data.event) {
          onUpdatedRef.current(data.event);
        }
      },
    });
  }

  const showBlockingOverlay = generating || loading;

  return (
    <div className="admin-card admin-form-wrap" id="registration-qr">
      <ActionConfirmDialogs hook={confirmHook} />

      <h3 className="admin-card-title font-display">Registration QR (Pubmat)</h3>
      <p className="admin-card-desc">
        Auto-generated via{" "}
        <a
          href="https://quickchart.io/qr-code-api/"
          target="_blank"
          rel="noopener noreferrer"
          className="admin-link"
        >
          QuickChart
        </a>
        . Scanning this QR opens the registration form for this event.
      </p>

      <div className="admin-form mt-3 admin-form-wrap">
        {showBlockingOverlay && <LoadingOverlay show scope="local" variant="qr" />}

        {error && <div className="admin-alert admin-alert--error">{error}</div>}

        {details ? (
          <>
            <div className="admin-qr-preview">
              <Image
                src={details.qrCodeUrl}
                alt={`Registration QR code for ${event.title}`}
                width={180}
                height={180}
                className="admin-qr-image"
              />
            </div>

            <label className="admin-label mt-3">Registration link</label>
            <a
              href={details.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-link admin-registration-qr-link"
            >
              {details.registrationUrl}
            </a>

            <div className="d-flex flex-wrap gap-2 mt-3">
              <a href={details.qrCodeUrl} download className="admin-link-btn">
                Download QR PNG
              </a>
              <a
                href={details.quickChartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-link-btn"
              >
                Open QuickChart URL
              </a>
            </div>
          </>
        ) : generating ? (
          <QrPanelSkeleton />
        ) : (
          !error && <p className="admin-muted mb-0">Preparing registration QR...</p>
        )}

        <button
          type="button"
          className="btn-primary mt-3"
          onClick={handleRegenerate}
          disabled={showBlockingOverlay}
        >
          {showBlockingOverlay ? "Please wait..." : "Regenerate Registration QR"}
        </button>
      </div>
    </div>
  );
}
