"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { FadeReveal } from "@/components/ui/FadeReveal";

type PaymentMethod = "qr" | "bank";

interface BankTransferInfo {
  accountName: string;
  accountNumber: string;
  bankName?: string;
}

interface RegistrationSidebarEvent {
  id: string;
  title: string;
  qrCodeUrl: string | null;
  bankTransfer: BankTransferInfo;
}

function isRemoteImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function RegistrationPaymentQr({
  variant = "sidebar",
  eventId = null,
}: {
  variant?: "sidebar" | "form";
  eventId?: string | null;
}) {
  const [event, setEvent] = useState<RegistrationSidebarEvent | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qr");
  const [qrBroken, setQrBroken] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);

    fetch(`/api/events/registration-sidebar?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const nextEvent = data.event ?? null;
        setEvent(nextEvent);
        setQrBroken(false);
        if (nextEvent && !nextEvent.qrCodeUrl) {
          setPaymentMethod("bank");
        }
      })
      .catch(() => setEvent(null));
  }, [eventId]);

  if (!event) return null;

  const isSidebar = variant === "sidebar";
  const hasQr = Boolean(event.qrCodeUrl) && !qrBroken;
  const showQr = paymentMethod === "qr" && hasQr;
  const showBank = paymentMethod === "bank" || (paymentMethod === "qr" && !hasQr);
  const qrIsRemote = Boolean(event.qrCodeUrl && isRemoteImageUrl(event.qrCodeUrl));

  return (
    <div className={isSidebar ? "registration-sidebar-card" : "registration-payment-qr-form"}>
      <h3 className="registration-sidebar-card-title">Scan to Pay</h3>
      <p className="registration-sidebar-card-copy">
        {showBank
          ? "Transfer to the account below, then upload your proof of payment in the form."
          : "Use the QR code and numbered steps to pay, then upload your proof of payment."}
      </p>

      <div className="registration-payment-panels">
        <FadeReveal show={showQr} className="registration-fade-reveal--panel">
          <div className="registration-payment-qr-layout">
            <div className="registration-payment-qr-frame registration-payment-qr-frame--sidebar">
              <Image
                src={event.qrCodeUrl!}
                alt={`Payment QR code for ${event.title}`}
                width={200}
                height={200}
                className="registration-payment-qr-image"
                unoptimized={qrIsRemote || event.qrCodeUrl!.startsWith("/uploads/")}
                onError={() => {
                  setQrBroken(true);
                  setPaymentMethod("bank");
                }}
              />
            </div>
            <div className="registration-payment-qr-guide">
              <p className="registration-payment-qr-guide-title">How to pay with QR</p>
              <ol className="registration-payment-qr-steps">
                <li>
                  <span className="registration-payment-qr-step-num" aria-hidden="true">
                    1
                  </span>
                  <span>
                    Open your <strong>bank</strong> or <strong>e-wallet</strong> app (BPI, GCash,
                    Maya, UnionBank, or any QR Ph app).
                  </span>
                </li>
                <li>
                  <span className="registration-payment-qr-step-num" aria-hidden="true">
                    2
                  </span>
                  <span>
                    Tap <strong>Scan QR</strong>, <strong>Pay QR</strong>, or{" "}
                    <strong>QR Ph</strong>.
                  </span>
                </li>
                <li>
                  <span className="registration-payment-qr-step-num" aria-hidden="true">
                    3
                  </span>
                  <span>
                    Scan the QR code on the left and confirm the merchant is{" "}
                    <strong>Philippine Nurses Association, Inc.</strong>
                  </span>
                </li>
                <li>
                  <span className="registration-payment-qr-step-num" aria-hidden="true">
                    4
                  </span>
                  <span>
                    Enter the <strong>exact registration amount</strong> shown in this form, then
                    confirm and send payment.
                  </span>
                </li>
                <li>
                  <span className="registration-payment-qr-step-num" aria-hidden="true">
                    5
                  </span>
                  <span>
                    Take a <strong>screenshot</strong> or download the receipt. Keep the{" "}
                    <strong>reference / transaction number</strong> visible.
                  </span>
                </li>
                <li>
                  <span className="registration-payment-qr-step-num" aria-hidden="true">
                    6
                  </span>
                  <span>
                    Upload that proof of payment in the field below to finish registration.
                  </span>
                </li>
              </ol>
              <p className="registration-payment-qr-tip mb-0">
                Payment without completing this registration form will not be counted.
              </p>
            </div>
          </div>
        </FadeReveal>

        <FadeReveal show={showBank} className="registration-fade-reveal--panel">
          <div className="registration-bank-details">
            {event.bankTransfer.bankName ? (
              <p className="registration-bank-details-bank">{event.bankTransfer.bankName}</p>
            ) : null}
            <p className="registration-bank-details-label">Account Name</p>
            <p className="registration-bank-details-value">{event.bankTransfer.accountName}</p>
            <p className="registration-bank-details-label">Account Number</p>
            <p className="registration-bank-details-value registration-bank-details-number">
              {event.bankTransfer.accountNumber}
            </p>
          </div>
        </FadeReveal>
      </div>

      <div className="registration-payment-toggle">
        <p className="registration-payment-toggle-label">Accepted via:</p>
        <div
          className="registration-payment-toggle-options"
          role="group"
          aria-label="Payment method"
        >
          <button
            type="button"
            className={`registration-payment-toggle-btn${
              paymentMethod === "qr" ? " is-active" : ""
            }`}
            onClick={() => setPaymentMethod("qr")}
            disabled={!hasQr}
          >
            Accepted QR
          </button>
          <button
            type="button"
            className={`registration-payment-toggle-btn${
              paymentMethod === "bank" ? " is-active" : ""
            }`}
            onClick={() => setPaymentMethod("bank")}
          >
            Bank Transfer
          </button>
        </div>
      </div>

      <p className="registration-payment-compliance">
        If you need a sales invoice, you can request one during registration and upload BIR Form
        2303 and BIR Form 2307. Otherwise, a standard receipt naming is enough.
      </p>
    </div>
  );
}
