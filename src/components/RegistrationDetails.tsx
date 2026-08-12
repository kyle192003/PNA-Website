"use client";

import { useEffect, useState } from "react";
import { conference } from "@/lib/conference";
import { formatPeso, normalizeEventFees } from "@/lib/registration-fees";
const inclusions = [
  "2 snacks, lunch and conference kit for the 3 day event",
  "Access to all plenary and parallel sessions",
  "Certificate of participation",
];

export function RegistrationDetails({ variant = "default" }: { variant?: "default" | "sidebar" }) {
  const isSidebar = variant === "sidebar";
  const fees = normalizeEventFees(conference.registration.fees);
  const [earlyBirdAvailable, setEarlyBirdAvailable] = useState(true);

  useEffect(() => {
    fetch("/api/events/early-bird")
      .then((res) => res.json())
      .then((data) => setEarlyBirdAvailable(Boolean(data.available)))
      .catch(() => setEarlyBirdAvailable(true));
  }, []);

  const visibleFees = [
    ...(earlyBirdAvailable
      ? [
          {
            label: fees.earlyBird.label,
            caption: fees.earlyBird.caption,
            amount: fees.earlyBird.amount,
          },
        ]
      : [
          {
            label: fees.regular.label,
            caption: fees.regular.caption ?? "Standard registration rate",
            amount: fees.regular.amount,
          },
          {
            label: fees.seniorPwd.label,
            caption: "Valid Senior Citizen or PWD ID required",
            amount: fees.earlyBird.amount,
          },
        ]),
    {
      label: fees.nonMember.label,
      caption:
        fees.nonMember.caption ??
        "For participants who are not PNA members (Senior/PWD non-members use the Senior/PWD rate)",
      amount: fees.nonMember.amount,
    },
  ];

  return (
    <div className={`d-flex flex-column ${isSidebar ? "gap-4 registration-details-sidebar" : "gap-3"}`}>
      <div className={isSidebar ? "registration-sidebar-block" : "glass-card-active glass-card p-3 p-md-4"}>
        <h3 className={`font-display fw-bold h6 mb-3 ${isSidebar ? "registration-sidebar-heading" : "text-ink"}`}>
          Official Registration Fees
        </h3>
        <div className="d-flex flex-column gap-3">
          {visibleFees.map((fee) => (
            <div
              key={fee.label}
              className={`pb-3 ${isSidebar ? "registration-sidebar-fee" : "border-bottom border-green-100 last:border-0 last:pb-0"}`}
            >
              <p className={`fw-medium small mb-1 ${isSidebar ? "registration-sidebar-text" : "text-ink"}`}>
                {fee.label}
              </p>
              {fee.caption ? (
                <p className={`small mb-1 ${isSidebar ? "registration-sidebar-muted" : "text-muted"}`}>
                  {fee.caption}
                </p>
              ) : null}
              <div className="d-flex justify-content-between small">
                <span className={isSidebar ? "registration-sidebar-muted" : "text-muted"}>Amount</span>
                <span className={`fw-bold ${isSidebar ? "text-green-100" : "text-accent"}`}>
                  {formatPeso(fee.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={isSidebar ? "registration-sidebar-block" : "glass-card p-3 p-md-4"}>
        <h3 className={`font-display fw-bold h6 mb-3 ${isSidebar ? "registration-sidebar-heading" : "text-ink"}`}>
          Important Dates
        </h3>
        <dl className="mb-0 small">
          <div className="mb-2">
            <dt className={isSidebar ? "registration-sidebar-muted" : "text-muted"}>Registration Deadline</dt>
            <dd className={`fw-semibold mb-0 ${isSidebar ? "registration-sidebar-text" : "text-ink"}`}>
              {conference.registration.registrationClosesAt}
            </dd>
          </div>
          <div>
            <dt className={isSidebar ? "registration-sidebar-muted" : "text-muted"}>Conference Dates</dt>
            <dd className={`fw-semibold mb-0 ${isSidebar ? "registration-sidebar-text" : "text-ink"}`}>
              {conference.dates.display}
            </dd>
          </div>
        </dl>
      </div>

      <div className={isSidebar ? "registration-sidebar-block" : "glass-card p-3 p-md-4"}>
        <h3 className={`font-display fw-bold h6 mb-3 ${isSidebar ? "registration-sidebar-heading" : "text-ink"}`}>
          Program Inclusions
        </h3>
        <ul className={`list-unstyled d-flex flex-column gap-2 small mb-0 ${isSidebar ? "registration-sidebar-muted" : "text-muted"}`}>
          {inclusions.map((item) => (
            <li key={item} className="d-flex align-items-start gap-2">
              <CheckIcon light={isSidebar} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className={`small mb-0 ${isSidebar ? "registration-sidebar-muted" : "text-muted"}`}>
        For registration assistance, contact{" "}
        <a
          href={`mailto:${conference.contact.registrationEmail}`}
          className={isSidebar ? "registration-sidebar-link" : "text-accent text-decoration-none"}
        >
          {conference.contact.registrationEmail}
        </a>
      </p>
    </div>
  );
}

function CheckIcon({ light = false }: { light?: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      className={`flex-shrink-0 mt-1 ${light ? "text-green-200" : "text-accent"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
