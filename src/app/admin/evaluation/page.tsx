import { EvaluationAdminPanel } from "@/components/admin/EvaluationAdminPanel";
import { getAllEvents } from "@/lib/events";

export default async function AdminEvaluationPage() {
  const events = await getAllEvents();

  return <EvaluationAdminPanel events={events} />;
}
