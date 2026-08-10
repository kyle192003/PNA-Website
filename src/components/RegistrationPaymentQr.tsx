"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

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
          : "Scan the QR code to pay securely."}
      </p>

      {showQr ? (
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
      ) : showBank ? (
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
      ) : (
        <p className="registration-sidebar-card-copy mb-0">
          QR payment is not available for this event. Please use bank transfer.
        </p>
      )}

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
        Payments are handled in line with Philippine BIR requirements, including{" "}
        <strong>BIR Form 2303</strong> (Certificate of Registration) and{" "}
        <strong>BIR Form 2307</strong> (Certificate of Creditable Tax Withheld at Source),
        where applicable.
      </p>
    </div>
  );
}
