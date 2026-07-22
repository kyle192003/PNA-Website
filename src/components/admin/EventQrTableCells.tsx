import Image from "next/image";
import Link from "next/link";

export function RegistrationQrTableCell({
  eventId,
  eventTitle,
  qrCodeUrl,
}: {
  eventId: string;
  eventTitle: string;
  qrCodeUrl: string | null;
}) {
  const manageHref = `/admin/events/${eventId}#registration-qr`;

  if (!qrCodeUrl) {
    return (
      <div className="admin-table-qr-cell">
        <Link href={manageHref} className="admin-link admin-table-qr-link">
          Generate
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-table-qr-cell">
      <Link href={manageHref} className="admin-table-qr-thumb-link" title={`View ${eventTitle} registration QR`}>
        <Image
          src={qrCodeUrl}
          alt={`Registration QR for ${eventTitle}`}
          width={72}
          height={72}
          className="admin-table-qr-thumb"
        />
      </Link>
      <div className="admin-table-qr-actions">
        <a href={qrCodeUrl} download className="admin-link">
          Download
        </a>
        <Link href={manageHref} className="admin-link">
          Manage
        </Link>
      </div>
    </div>
  );
}

export function PaymentQrTableCell({
  eventId,
  eventTitle,
  qrCodeUrl,
}: {
  eventId: string;
  eventTitle: string;
  qrCodeUrl: string | null;
}) {
  const manageHref = `/admin/events/${eventId}#payment-qr`;

  if (!qrCodeUrl) {
    return (
      <div className="admin-table-qr-cell">
        <Link href={manageHref} className="admin-link admin-table-qr-link">
          Upload
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-table-qr-cell">
      <Link href={manageHref} className="admin-table-qr-thumb-link" title={`View ${eventTitle} payment QR`}>
        <Image
          src={qrCodeUrl}
          alt={`Payment QR for ${eventTitle}`}
          width={72}
          height={72}
          className="admin-table-qr-thumb"
        />
      </Link>
      <div className="admin-table-qr-actions">
        <a href={qrCodeUrl} download className="admin-link">
          Download
        </a>
        <Link href={manageHref} className="admin-link">
          Manage
        </Link>
      </div>
    </div>
  );
}
