"use client";

import { useEffect, useState } from "react";
import { conference } from "@/lib/conference";
import { formatPeso, normalizeEventFees } from "@/lib/registration-fees";
import type { EventFees } from "@/lib/types/admin";
// Re-export for RegistrationModal compatibility
export type RegistrationPaymentBreakdown = {
  categoryLabel: string;
  feeTierLabel: string;
  unitFee: number;
  headcount: number;
  totalFee: number;
};

interface SidebarEvent {
  id: string;
  title: string;
  datesDisplay: string;
  venueName: string;
  venueAddress?: string;
  earlyBirdDeadline: string;
  regularDeadline?: string;
  fees: EventFees;
  earlyBirdAvailable?: boolean;
}

export function RegistrationSidebar({
  eventId = null,
  paymentBreakdown = null,
}: {
  eventId?: string | null;
  /** @deprecated Payment QR / bank details live in the form payment section. */
  showPaymentQr?: boolean;
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

  const fees = normalizeEventFees(event?.fees ?? conference.registration.fees);
  const earlyBirdAvailable = event?.earlyBirdAvailable ?? true;
  const datesDisplay = event?.datesDisplay ?? conference.dates.display;
  const venueName = event?.venueName ?? conference.venue.name;
  const deadline =
    event?.regularDeadline?.trim() ||
    event?.earlyBirdDeadline?.trim() ||
    conference.registration.registrationClosesAt ||
    conference.registration.regularDeadline;
  const renewalUrl = conference.membershipRenewalUrl;

  return (
    <aside className="registration-modal-sidebar" aria-label="Registration information">
      <div className="registration-sidebar-card">
        <div className="registration-sidebar-card-head">
          <SidebarClipboardIcon />
          <h3 className="registration-sidebar-card-title">Important Reminder</h3>
        </div>
        <p className="registration-sidebar-card-copy mb-0">
          You do not need to be an active PNA member to register. We encourage you to renew or
          update your membership when you can. Renew here:{" "}
          <a href={renewalUrl} target="_blank" rel="noopener noreferrer">
            www.philippinenurses.org
          </a>
        </p>
      </div>

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
                  Amount due <strong>{formatPeso(paymentBreakdown.totalFee)}</strong>
                </span>
              </div>
            </div>
            <div className="registration-sidebar-payment-total">
              <span>Total due</span>
              <strong>{formatPeso(paymentBreakdown.totalFee)}</strong>
            </div>
          </div>
        ) : (
          <div className="registration-sidebar-fees">
            {earlyBirdAvailable ? (
              <div className="registration-sidebar-fee-row">
                <p className="registration-sidebar-fee-label">{fees.earlyBird.label}</p>
                <strong className="registration-sidebar-fee-amount">
                  {formatPeso(fees.earlyBird.amount)}
                </strong>
              </div>
            ) : (
              <>
                <div className="registration-sidebar-fee-row">
                  <p className="registration-sidebar-fee-label">{fees.regular.label}</p>
                  <strong className="registration-sidebar-fee-amount">
                    {formatPeso(fees.regular.amount)}
                  </strong>
                </div>
                <div className="registration-sidebar-fee-row">
                  <p className="registration-sidebar-fee-label">{fees.seniorPwd.label}</p>
                  <strong className="registration-sidebar-fee-amount">
                    {formatPeso(fees.earlyBird.amount)}
                  </strong>
                </div>
              </>
            )}
            <div className="registration-sidebar-fee-row">
              <p className="registration-sidebar-fee-label">{fees.nonMember.label}</p>
              <strong className="registration-sidebar-fee-amount">
                {formatPeso(fees.nonMember.amount)}
              </strong>
            </div>
            <p className="registration-sidebar-card-copy mt-3 mb-0">
              <strong>Registration Includes:</strong> {conference.registration.includes}
            </p>
          </div>
        )}
      </div>

      <div className="registration-sidebar-card">
        <div className="registration-sidebar-card-head">
          <SidebarClipboardIcon />
          <h3 className="registration-sidebar-card-title">Important Information</h3>
        </div>
        <ul className="registration-sidebar-info-list">
          <li>
            <strong>Renew Your Membership:</strong> We encourage you to renew your PNA membership
            at{" "}
            <a href={renewalUrl} target="_blank" rel="noopener noreferrer">
              www.philippinenurses.org
            </a>
            .
          </li>
          <li>
            <strong>Conference Dates:</strong> {datesDisplay}
          </li>
          <li>
            <strong>Venue:</strong> {venueName}
          </li>
          <li>
            <strong>Registration Deadline:</strong> Closes on {deadline}.
          </li>
          <li>All attendees must register through the website.</li>
          <li>No Onsite Registration.</li>
          <li>Register online immediately after payment to avoid inconvenience.</li>
          <li>Payment without completing the registration form will not be considered.</li>
        </ul>
      </div>

      <div className="registration-sidebar-card">
        <div className="registration-sidebar-card-head">
          <SidebarClipboardIcon />
          <h3 className="registration-sidebar-card-title">Prepare These Documents</h3>
        </div>
        <ol className="registration-sidebar-info-list registration-sidebar-info-list--ordered">
          <li>Copy or screenshot of the proof of payment</li>
          <li>Valid PRC ID</li>
          <li>Senior Citizen/PWD ID (if applicable)</li>
          <li>BIR Form 2303 and 2307 (only if you request a sales invoice)</li>
        </ol>
        <p className="registration-sidebar-card-copy mb-0 mt-3">
          Thank you for your cooperation, and we look forward to your participation!
        </p>
      </div>

      <div className="registration-sidebar-card">
        <div className="registration-sidebar-card-head">
          <SidebarHelpIcon />
          <h3 className="registration-sidebar-card-title">Need Help?</h3>
        </div>
        <ul className="registration-sidebar-help-list">
          <li>
            <SidebarMailIcon />
            <a href="mailto:philippinenursesassociation@yahoo.com.ph">
              philippinenursesassociation@yahoo.com.ph
            </a>
          </li>
          <li>
            <SidebarMailIcon />
            <a href={`mailto:${conference.contact.registrationEmail}`}>
              {conference.contact.registrationEmail}
            </a>
          </li>
          <li>
            <SidebarPhoneIcon />
            <span>
              <a href="tel:+63270019859">(632) 7001 9859</a>
              {" | "}
              <a href="tel:+639190857360">(0919) 085 7360</a>
            </span>
          </li>
        </ul>
      </div>
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
      <path d="M4 14a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
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
