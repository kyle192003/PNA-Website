"use client";

import { conference } from "@/lib/conference";
import { formatParticipantName } from "@/lib/participant-name";
import { Modal } from "@/components/ui/Modal";

export interface RegistrationSuccessDetails {
  referenceNumber: string;
  firstName: string;
  lastName: string;
  middleInitial?: string;
  email: string;
  phone: string;
  organization: string;
  position: string;
  category: string;
  receiptUploaded?: boolean;
}
interface RegistrationSuccessModalProps {
  open: boolean;
  onClose: () => void;
  details: RegistrationSuccessDetails | null;
}

export function RegistrationSuccessModal({
  open,
  onClose,
  details,
}: RegistrationSuccessModalProps) {
  if (!details) return null;

  return (
    <Modal open={open} onClose={onClose} title="Registration Confirmation">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface mb-4">
          <svg className="h-8 w-8 text-accent-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-display text-xl font-bold text-ink">Registration Successfully Recorded</h3>
        <p className="mt-2 text-sm text-muted">
          Thank you, {formatParticipantName(details)}. Your official registration for the{" "}
          {conference.conferenceName} has been received by the Secretariat.
        </p>
      </div>

      <div className="mt-6 rounded-xl bg-surface border border-accent/25 p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-accent-glow">
          Official Reference Number
        </p>
        <p className="mt-1 font-display text-xl sm:text-2xl font-bold text-ink tracking-wide break-all">
          {details.referenceNumber}
        </p>
        <p className="mt-2 text-xs text-muted">
          Please retain this reference number for verification and on-site check-in.
        </p>
      </div>

      <dl className="mt-6 space-y-3 text-sm">
        <DetailRow label="Full Name" value={formatParticipantName(details)} />
        <DetailRow label="Email" value={details.email} />
        <DetailRow label="Phone" value={details.phone} />
        <DetailRow label="Organization" value={details.organization} />
        <DetailRow label="Position" value={details.position} />
        <DetailRow label="Category" value={details.category} />
        <DetailRow label="Conference Dates" value={conference.dates.display} />
        <DetailRow label="Venue" value={conference.venue.name} />
      </dl>

      <div className="mt-6 rounded-lg border border-accent/20 bg-surface/50 p-4 text-sm text-muted leading-relaxed">
        <p className="font-semibold text-ink mb-1">Subsequent Steps</p>
        {details.receiptUploaded ? (
          <p>
            Your proof of payment has been submitted and is pending review by the Secretariat.
            Retain your reference number for verification and on-site check-in.
          </p>
        ) : (
          <p>
            Complete payment using the QR code in the registration form, then upload your proof of
            payment using your reference number via the registration lookup section. For assistance,
            contact{" "}
            <a
              href={`mailto:${conference.contact.registrationEmail}`}
              className="text-accent hover:underline"
            >
              {conference.contact.registrationEmail}
            </a>
            .
          </p>
        )}
      </div>
      <button type="button" onClick={onClose} className="btn-primary w-full mt-6">
        Acknowledge
      </button>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 border-b border-green-50 pb-3 last:border-0 last:pb-0">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="font-medium text-ink sm:text-right break-words">{value}</dd>
    </div>
  );
}
