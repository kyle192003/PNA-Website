import { getAdminDashboardData } from "@/lib/admin-dashboard";
import { AdminDashboardOverview } from "@/components/admin/dashboard/AdminDashboardOverview";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  return (
    <div className="admin-page">
      <AdminDashboardOverview data={data} />
    </div>
  );
}
