import { AdminChangePasswordForm } from "@/components/admin/AdminChangePasswordForm";

export default function AdminSettingsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display">Settings</h1>
          <p className="admin-muted">
            Update your admin password anytime. Use a strong password to keep the dashboard secure.
          </p>
        </div>
      </div>

      <div className="admin-card admin-settings-card">
        <div className="admin-settings-card-head">
          <h2 className="admin-card-title font-display">Change Password</h2>
          <p className="admin-muted admin-settings-copy">
            Your new password must meet all requirements shown below before it can be saved.
          </p>
        </div>
        <AdminChangePasswordForm />
      </div>
    </div>
  );
}
