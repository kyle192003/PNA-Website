import { AdminChangePasswordForm } from "@/components/admin/AdminChangePasswordForm";
import { AdminResetPanel } from "@/components/admin/AdminResetPanel";

export default function AdminSettingsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display">Settings</h1>
          <p className="admin-muted">
            Update your admin password anytime, or wipe demo data for a clean presentation start.
          </p>
        </div>
      </div>

      <div className="admin-settings-stack">
        <div className="admin-card admin-settings-card">
          <div className="admin-settings-card-head">
            <h2 className="admin-card-title font-display">Change Password</h2>
            <p className="admin-muted admin-settings-copy">
              Your new password must meet all requirements shown below before it can be saved.
            </p>
          </div>
          <AdminChangePasswordForm />
        </div>

        <div className="admin-card admin-settings-card admin-settings-card--danger">
          <div className="admin-settings-card-head">
            <h2 className="admin-card-title font-display">Reset dashboard</h2>
            <p className="admin-muted admin-settings-copy">
              Clears events, participants, inquiries, receipts, QR codes, and certificates so you can
              present from a fresh start. Your admin login is not removed.
            </p>
          </div>
          <AdminResetPanel />
        </div>
      </div>
    </div>
  );
}
