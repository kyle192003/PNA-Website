"use client";

import { useState, type FormEvent } from "react";
import { conference } from "@/lib/conference";
import { useRegistrationLookup } from "@/hooks/use-registrations";
import { formatParticipantName } from "@/lib/participant-name";
import { PaymentStatusBadge } from "@/components/admin/PaymentStatusBadge";
import { LookupResultSkeleton } from "@/components/ui/Skeleton";

export function RegistrationLookup({
  variant = "default",
}: {
  variant?: "default" | "sidebar" | "chatbot";
}) {
  const isSidebar = variant === "sidebar";
  const isChatbot = variant === "chatbot";
  const compact = isSidebar || isChatbot;
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [searchReference, setSearchReference] = useState("");
  const [searchEmail, setSearchEmail] = useState("");

  const lookupQuery = useRegistrationLookup(
    searchReference,
    searchEmail,
    searchReference.length > 0 && searchEmail.length > 0
  );

  function handleLookup(e: FormEvent) {
    e.preventDefault();
    const trimmedRef = reference.trim().toUpperCase();
    const trimmedEmail = email.trim();
    if (!trimmedRef || !trimmedEmail) return;
    setSearchReference(trimmedRef);
    setSearchEmail(trimmedEmail);
  }

  const isBusy = lookupQuery.isFetching;

  return (
    <div
      className={
        isChatbot
          ? "registration-lookup-wrap registration-lookup-wrap--chatbot"
          : `registration-lookup-wrap ${isSidebar ? "registration-sidebar-block" : "glass-card p-6"}`
      }
    >
      {!isChatbot ? (
        <>
          <h3
            className={`font-display font-bold mb-2 ${isSidebar ? "registration-sidebar-heading h6" : "text-ink"}`}
          >
            Check Registration Status
          </h3>
          <p className={`text-sm mb-4 ${isSidebar ? "registration-sidebar-muted" : "text-muted"}`}>
            Enter your reference number and the email used at registration to verify your status.
          </p>
        </>
      ) : (
        <p className="registration-lookup-chatbot-help mb-3">
          Enter your reference number and the email used at registration to verify your status.
        </p>
      )}

      <form onSubmit={handleLookup} className="d-flex flex-column gap-2">
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="PNA-2026-A1B2C3D4"
          className={`uppercase ${compact ? "registration-sidebar-input" : "input-dark"}`}
          disabled={isBusy}
          autoComplete="off"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email used at registration"
          className={compact ? "registration-sidebar-input" : "input-dark"}
          disabled={isBusy}
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={isBusy || !reference.trim() || !email.trim()}
          className={`btn-primary ${compact ? "registration-sidebar-btn" : "!py-2.5 !px-4 !text-xs"}`}
        >
          Look Up
        </button>
      </form>

      {lookupQuery.isFetching && <LookupResultSkeleton />}

      {lookupQuery.isError && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${compact ? "registration-sidebar-error" : "bg-red-500/10 border border-red-500/30 text-red-300"}`}
        >
          {lookupQuery.error.message}
        </div>
      )}

      {lookupQuery.isSuccess && lookupQuery.data && (
        <div
          className={`mt-4 rounded-lg p-4 ${compact ? "registration-sidebar-success" : "bg-emerald-500/10 border border-emerald-500/30"}`}
        >
          <p
            className={`text-sm font-semibold mb-2 ${compact ? "text-green-100" : "text-emerald-300"}`}
          >
            Registration Found
          </p>
          <dl
            className={`space-y-1 text-sm ${compact ? "registration-sidebar-muted" : "text-emerald-200/80"}`}
          >
            <div className="flex justify-between gap-4">
              <dt className={compact ? "registration-sidebar-muted" : "text-emerald-400"}>
                Reference
              </dt>
              <dd
                className={`font-semibold ${compact ? "registration-sidebar-text" : "text-ink"}`}
              >
                {lookupQuery.data.referenceNumber}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className={compact ? "registration-sidebar-muted" : "text-emerald-400"}>Name</dt>
              <dd className={compact ? "registration-sidebar-text" : undefined}>
                {formatParticipantName(lookupQuery.data)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className={compact ? "registration-sidebar-muted" : "text-emerald-400"}>
                Email
              </dt>
              <dd className={`text-end ${compact ? "registration-sidebar-text" : undefined}`}>
                {lookupQuery.data.emailMasked}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className={compact ? "registration-sidebar-muted" : "text-emerald-400"}>
                Organization
              </dt>
              <dd className={`text-end ${compact ? "registration-sidebar-text" : undefined}`}>
                {lookupQuery.data.organization}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className={compact ? "registration-sidebar-muted" : "text-emerald-400"}>
                Category
              </dt>
              <dd className={compact ? "registration-sidebar-text" : undefined}>
                {(conference.registration.fees as Record<string, { label?: string }>)[
                  lookupQuery.data.category
                ]?.label ?? lookupQuery.data.category}
              </dd>
            </div>
            <div className="flex justify-between gap-4 align-items-center">
              <dt className={compact ? "registration-sidebar-muted" : "text-emerald-400"}>
                Payment
              </dt>
              <dd>
                <PaymentStatusBadge status={lookupQuery.data.paymentStatus} />
              </dd>
            </div>
          </dl>

          {lookupQuery.data.paymentNotes && (
            <p className={`mt-3 mb-0 small ${compact ? "registration-sidebar-text" : "text-ink"}`}>
              <strong>Note:</strong> {lookupQuery.data.paymentNotes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
