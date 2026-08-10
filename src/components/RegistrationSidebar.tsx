"use client";

import { useEffect, useState } from "react";
import { conference } from "@/lib/conference";
import { formatPeso } from "@/lib/registration-fees";
import { RegistrationLookup } from "@/components/RegistrationLookup";
import { RegistrationPaymentQr } from "@/components/RegistrationPaymentQr";

interface SidebarEvent {
  id: string;
  title: string;
  datesDisplay: string;
  venueName: string;
  earlyBirdDeadline: string;
  fees: typeof conference.registration.fees;
}

export type RegistrationPaymentBreakdown = {
  categoryLabel: string;
  feeTierLabel: string;
  unitFee: number;
  headcount: number;
  totalFee: number;
};

export function RegistrationSidebar({
  eventId = null,
  showPaymentQr = true,
  paymentBreakdown = null,
}: {
  eventId?: string | null;
  /** When false, QR/bank payment card is hidden (shown in the payment form step instead). */
  showPaymentQr?: boolean;
  /** When set (Payment / Review steps), replaces the fee schedule with this participant's total. */
  paymentBreakdown?: RegistrationPaymentBreakdown | null;
}) {
  const [event, setEvent] = useState<SidebarEvent | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);

    fetch(`/api/events/registration-sidebar?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setEvent(data.event ?? null))
      .catch(() => setEvent(null));
  }, [eventId]);

  const fees = event?.fees ?? conference.registration.fees;
  const sidebarFeeKeys: Array<keyof typeof conference.registration.fees> = ["member", "government", "private"];
  const datesDisplay = event?.datesDisplay ?? conference.dates.display;
  const venueName = event?.venueName ?? conference.venue.name;
  const earlyBirdDeadline = event?.earlyBirdDeadline ?? conference.registration.earlyBirdDeadline;

  return (
    <aside className="registration-modal-sidebar" aria-label="Registration information">
      <div className="registration-sidebar-card">
        <div className="registration-sidebar-card-head">
          <SidebarClipboardIcon />
          <h3 className="registration-sidebar-card-title">Registration Summary</h3>
        </div>
        <ul className="registration-sidebar-summary-list">
          <li>
            <SidebarCalendarIcon />
            <span>{datesDisplay}</span>
          </li>
          <li>
            <SidebarPinIcon />
            <span>{venueName}</span>
          </li>
          <li className="registration-sidebar-summary-list-item--accent">
            <SidebarClockIcon />
            <span>
              Early Bird Deadline: <strong>{earlyBirdDeadline}</strong>
            </span>
          </li>
        </ul>
      </div>

      {showPaymentQr ? <RegistrationPaymentQr variant="sidebar" eventId={eventId} /> : null}

      <div className="registration-sidebar-card">
        <div className="registration-sidebar-card-head">
          <SidebarTagIcon />
          <h3 className="registration-sidebar-card-title">
            {paymentBreakdown ? "Your Payment" : "Registration Fees"}
          </h3>
        </div>
        {paymentBreakdown ? (
          <div className="registration-sidebar-payment-breakdown">
            <div className="registration-sidebar-fee-row">
              <p className="registration-sidebar-fee-label">{paymentBreakdown.categoryLabel}</p>
              <div className="registration-sidebar-fee-prices">
                <span>
                  Rate <strong>{paymentBreakdown.feeTierLabel}</strong>
                </span>
                <span>
                  Fee per person <strong>{formatPeso(paymentBreakdown.unitFee)}</strong>
                </span>
                {paymentBreakdown.headcount > 1 ? (
                  <span>
                    Participants <strong>{paymentBreakdown.headcount}</strong>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="registration-sidebar-payment-total">
              <span>Total due</span>
              <strong>{formatPeso(paymentBreakdown.totalFee)}</strong>
            </div>
          </div>
        ) : (
          <div className="registration-sidebar-fees">
            {sidebarFeeKeys.map((key) => {
              const fee = fees[key];
              return (
                <div key={key} className="registration-sidebar-fee-row">
                  <p className="registration-sidebar-fee-label">{fee.label}</p>
                  <div className="registration-sidebar-fee-prices">
                    <span>
                      Early Bird <strong>₱{fee.early.toLocaleString()}</strong>
                    </span>
                    <span>
                      Regular <strong>₱{fee.regular.toLocaleString()}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="registration-sidebar-card">
        <div className="registration-sidebar-card-head">
          <SidebarHelpIcon />
          <h3 className="registration-sidebar-card-title">Need Help?</h3>
        </div>
        <ul className="registration-sidebar-help-list">
          <li>
            <SidebarMailIcon />
            <a href={`mailto:${conference.contact.registrationEmail}`}>
              {conference.contact.registrationEmail}
            </a>
          </li>
          <li>
            <SidebarPhoneIcon />
            <a href={`tel:${conference.contact.phone.replace(/\s/g, "")}`}>{conference.contact.phone}</a>
          </li>
        </ul>
      </div>

      <RegistrationLookup variant="sidebar" />
    </aside>
  );
}

function SidebarClipboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="4" width="10" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function SidebarCalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 3V7M16 3V7M4 10H20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function SidebarPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.33 6-10a6 6 0 1 0-12 0c0 4.67 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="11" r="2.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function SidebarClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8.5V12l2.5 2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function SidebarTagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12V6a1 1 0 0 1 1-1h5l8.5 8.5a1.4 1.4 0 0 1 0 2l-3.5 3.5a1.4 1.4 0 0 1-2 0L5 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="1.1" fill="currentColor" />
    </svg>
  );
}

function SidebarHelpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 14a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M8 14v1.5a4 4 0 0 0 8 0V14" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 18.5v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function SidebarMailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="m4.5 8 7.5 5.5L19.5 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function SidebarPhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.5 5.5h2l1.2 3-1.6 1.2a11 11 0 0 0 5.2 5.2l1.2-1.6 3 1.2v2a1.5 1.5 0 0 1-1.5 1.5A12.5 12.5 0 0 1 6 7a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}
