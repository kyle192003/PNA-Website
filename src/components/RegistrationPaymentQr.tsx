"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { FadeReveal } from "@/components/ui/FadeReveal";

type PaymentMethod = "qr" | "bank";

/** Temporarily hide QR payment; set to true to bring it back. */
const SHOW_QR_PAYMENT = false;

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    SHOW_QR_PAYMENT ? "qr" : "bank"
  );
  const [qrBroken, setQrBroken] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const helpTitleId = useId();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);

    fetch(`/api/events/registration-sidebar?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const nextEvent = data.event ?? null;
        setEvent(nextEvent);
        setQrBroken(false);
        if (!SHOW_QR_PAYMENT || (nextEvent && !nextEvent.qrCodeUrl)) {
          setPaymentMethod("bank");
        }
      })
      .catch(() => setEvent(null));
  }, [eventId]);

  useEffect(() => {
    if (!helpOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setHelpOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [helpOpen]);

  if (!event) return null;

  const isSidebar = variant === "sidebar";
  const hasQr = SHOW_QR_PAYMENT && Boolean(event.qrCodeUrl) && !qrBroken;
  const showQr = paymentMethod === "qr" && hasQr;
  const showBank =
    !SHOW_QR_PAYMENT || paymentMethod === "bank" || (paymentMethod === "qr" && !hasQr);
  const qrIsRemote = Boolean(event.qrCodeUrl && isRemoteImageUrl(event.qrCodeUrl));
  const bankName = event.bankTransfer.bankName?.trim() || "the bank shown above";

  const helpDialog =
    helpOpen && portalReady
      ? createPortal(
          <div className="registration-payment-help-dialog" role="presentation">
            <button
              type="button"
              className="registration-payment-help-backdrop"
              onClick={() => setHelpOpen(false)}
              aria-label="Close payment help"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={helpTitleId}
              className="registration-payment-help-panel"
            >
              <div className="registration-payment-help-header">
                <div>
                  <h3 id={helpTitleId} className="registration-payment-help-title font-display">
                    How to pay
                  </h3>
                  <p className="registration-payment-help-subtitle mb-0">
                    Follow either option below, then upload your proof of payment in this form.
                  </p>
                </div>
                <button
                  type="button"
                  className="registration-payment-help-close"
                  onClick={() => setHelpOpen(false)}
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="registration-payment-help-body">
                <section className="registration-payment-help-section">
                  <h4 className="registration-payment-help-section-title">
                    Option A — Mobile / online bank transfer
                  </h4>
                  <ol className="registration-payment-help-steps">
                    <li>
                      <span className="registration-payment-help-step-num" aria-hidden="true">
                        1
                      </span>
                      <span>
                        Open your <strong>mobile banking</strong> or <strong>e-wallet</strong> app
                        (for example BPI, BDO, UnionBank, Metrobank, GCash, or Maya).
                      </span>
                    </li>
                    <li>
                      <span className="registration-payment-help-step-num" aria-hidden="true">
                        2
                      </span>
                      <span>
                        Choose <strong>Send Money</strong>, <strong>Transfer</strong>, or{" "}
                        <strong>Pay to Bank Account</strong>.
                      </span>
                    </li>
                    <li>
                      <span className="registration-payment-help-step-num" aria-hidden="true">
                        3
                      </span>
                      <span>
                        Enter the bank details shown in this form: account name{" "}
                        <strong>{event.bankTransfer.accountName}</strong>
                        {event.bankTransfer.bankName
                          ? `, bank ${event.bankTransfer.bankName}`
                          : ""}
                        , and account number{" "}
                        <strong>{event.bankTransfer.accountNumber}</strong>.
                      </span>
                    </li>
                    <li>
                      <span className="registration-payment-help-step-num" aria-hidden="true">
                        4
                      </span>
                      <span>
                        Enter the <strong>exact registration amount</strong> shown in this form,
                        then review and confirm the transfer.
                      </span>
                    </li>
                    <li>
                      <span className="registration-payment-help-step-num" aria-hidden="true">
                        5
                      </span>
                      <span>
                        Save a <strong>screenshot</strong> or download the receipt. Keep the{" "}
                        <strong>reference / transaction number</strong> visible.
                      </span>
                    </li>
                    <li>
                      <span className="registration-payment-help-step-num" aria-hidden="true">
                        6
                      </span>
                      <span>
                        Return here and <strong>upload your proof of payment</strong> to complete
                        registration.
                      </span>
                    </li>
                  </ol>
                </section>

                <section className="registration-payment-help-section">
                  <h4 className="registration-payment-help-section-title">
                    Option B — Nearest bank branch / cheque deposit
                  </h4>
                  <ol className="registration-payment-help-steps">
                    <li>
                      <span className="registration-payment-help-step-num" aria-hidden="true">
                        1
                      </span>
                      <span>
                        Go to your nearest <strong>{bankName}</strong> branch (or a partner bank
                        that accepts deposits to this account).
                      </span>
                    </li>
                    <li>
                      <span className="registration-payment-help-step-num" aria-hidden="true">
                        2
                      </span>
                      <span>
                        Fill out a <strong>deposit slip</strong> or prepare a{" "}
                        <strong>cheque</strong> payable to{" "}
                        <strong>{event.bankTransfer.accountName}</strong>.
                      </span>
                    </li>
                    <li>
                      <span className="registration-payment-help-step-num" aria-hidden="true">
                        3
                      </span>
                      <span>
                        Provide account number{" "}
                        <strong>{event.bankTransfer.accountNumber}</strong> and deposit the{" "}
                        <strong>exact registration amount</strong>.
                      </span>
                    </li>
                    <li>
                      <span className="registration-payment-help-step-num" aria-hidden="true">
                        4
                      </span>
                      <span>
                        Ask for a stamped deposit slip / official receipt and keep a clear photo or
                        scan of it.
                      </span>
                    </li>
                    <li>
                      <span className="registration-payment-help-step-num" aria-hidden="true">
                        5
                      </span>
                      <span>
                        Upload that proof of payment in this registration form. Payment without
                        completing the form will not be counted.
                      </span>
                    </li>
                  </ol>
                </section>

                <p className="registration-payment-help-tip mb-0">
                  Tip: Double-check the account name and number before confirming. Use the exact
                  amount shown in your registration total.
                </p>
              </div>

              <div className="registration-payment-help-actions">
                <button
                  type="button"
                  className="registration-form-footer-btn registration-form-footer-btn--primary"
                  onClick={() => setHelpOpen(false)}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={isSidebar ? "registration-sidebar-card" : "registration-payment-qr-form"}>
      <h3 className="registration-sidebar-card-title">
        {SHOW_QR_PAYMENT ? "Scan to Pay" : "Bank Transfer"}
      </h3>
      <p className="registration-sidebar-card-copy">
        {showBank
          ? "Transfer to the account below, then upload your proof of payment in the form."
          : "Use the QR code and numbered steps to pay, then upload your proof of payment."}
      </p>

      <div className="registration-payment-panels">
        {SHOW_QR_PAYMENT ? (
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
        ) : null}

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

      {showBank ? (
        <button
          type="button"
          className="registration-payment-help-trigger"
          onClick={() => setHelpOpen(true)}
        >
          CLICK HERE if you need assistance on how to pay.
        </button>
      ) : null}

      {SHOW_QR_PAYMENT ? (
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
      ) : null}

      <p className="registration-payment-compliance">
        If you need a sales invoice, you can request one during registration and upload BIR Form
        2303 and BIR Form 2307. Otherwise, a standard receipt naming is enough.
      </p>

      {helpDialog}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
