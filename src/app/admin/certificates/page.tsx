import { CertificateTemplatePanel } from "@/components/admin/CertificateTemplatePanel";
import { getAllEvents } from "@/lib/events";

export default async function AdminCertificatesPage() {
  const events = await getAllEvents();
  return <CertificateTemplatePanel events={events} />;
}
