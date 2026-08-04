import Link from "next/link";
import type { AdminDashboardData } from "@/lib/admin-dashboard";
import { getGreeting } from "@/lib/greeting";
import { AdminEventsTable } from "@/components/admin/AdminEventsTable";
import { PaymentStatusBadge } from "@/components/admin/PaymentStatusBadge";
import {
  formatParticipantName,
  getParticipantInitials,
} from "@/lib/participant-name";
import {
  AdminHorizontalBarChart,
  AdminMiniBarChart,
  AdminVerticalBarChart,
} from "@/components/admin/dashboard/AdminBarCharts";

const metricIcons = {
  total: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 14V10M8 17V7M12 20V4M16 17V7M20 14V10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  ),
  paid: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  pending: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  review: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 7H16M8 12H16M8 17H12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ),
};

export function AdminDashboardOverview({ data }: { data: AdminDashboardData }) {
  const { stats, registrationsByDay, paymentStatusBreakdown, registrationsByCategory } = data;
  const greeting = getGreeting();

  const metricCards = [
    {
      label: "Total Participants",
      value: stats.totalParticipants,
      chart: registrationsByDay,
      icon: metricIcons.total,
      tone: "",
    },
    {
      label: "Paid",
      value: stats.paid,
      chart: data.paidByDay,
      icon: metricIcons.paid,
      tone: "admin-dashboard-metric-icon--blue",
    },
    {
      label: "Pending Payment",
      value: stats.pending,
      chart: data.pendingByDay,
      icon: metricIcons.pending,
      tone: "admin-dashboard-metric-icon--amber",
    },
    {
      label: "Under Review",
      value: stats.receiptSubmitted,
      chart: data.reviewByDay,
      icon: metricIcons.review,
      tone: "admin-dashboard-metric-icon--rose",
    },
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <div>
          <p className="admin-dashboard-eyebrow">{greeting}</p>
          <h1 className="admin-dashboard-welcome">
            Welcome back, <span className="admin-dashboard-welcome-accent">Admin</span>
          </h1>
          <p className="admin-muted mb-0">
            Here’s what’s happening with registrations, payments, and events.
          </p>
        </div>
        <div className="admin-dashboard-header-actions">
          <Link href="/admin/settings" className="admin-dashboard-export">
            Reset data
          </Link>
          <Link href="/admin/participants" className="admin-dashboard-export">
            View participants
          </Link>
          <Link href="/admin/events/new" className="admin-btn-primary">
            + New Event
          </Link>
        </div>
      </div>

      <div className="admin-dashboard-grid">
        {metricCards.map((card) => (
          <section key={card.label} className="admin-dashboard-card admin-dashboard-card--metric">
            <div className="admin-dashboard-metric-top">
              <div>
                <p className="admin-dashboard-metric-label">{card.label}</p>
                <p className="admin-dashboard-metric-value">{card.value}</p>
              </div>
              <span className={`admin-dashboard-metric-icon ${card.tone}`}>{card.icon}</span>
            </div>
            <AdminMiniBarChart data={card.chart} />
          </section>
        ))}

        <section className="admin-dashboard-card admin-dashboard-card--featured">
          <div className="admin-dashboard-card-head">
            <div>
              <h2 className="admin-dashboard-card-title">Registration Activity</h2>
              <p className="admin-dashboard-card-desc">New registrations over the last 7 days</p>
            </div>
            <div className="admin-dashboard-feature-value">
              <span className="admin-dashboard-feature-number">{stats.totalParticipants}</span>
              <span className="admin-dashboard-feature-label">Total participants</span>
            </div>
          </div>
          <AdminVerticalBarChart data={registrationsByDay} height={210} />
          <div className="admin-dashboard-feature-footer">
            <div>
              <span className="admin-dashboard-footer-label">Open events</span>
              <strong>{stats.activeEvents}</strong>
            </div>
            <div>
              <span className="admin-dashboard-footer-label">Upcoming soon</span>
              <strong>{stats.upcomingEvents}</strong>
            </div>
            <div>
              <span className="admin-dashboard-footer-label">Receipt issues</span>
              <strong>{stats.receiptIssue}</strong>
            </div>
          </div>
        </section>

        <section className="admin-dashboard-card admin-dashboard-card--featured">
          <div className="admin-dashboard-card-head">
            <div>
              <h2 className="admin-dashboard-card-title">Payment Status</h2>
              <p className="admin-dashboard-card-desc">Breakdown of participant payment progress</p>
            </div>
            <div className="admin-dashboard-feature-value">
              <span className="admin-dashboard-feature-number">{stats.paid}</span>
              <span className="admin-dashboard-feature-label">Paid participants</span>
            </div>
          </div>
          <AdminHorizontalBarChart data={paymentStatusBreakdown} />
          <div className="admin-dashboard-feature-footer">
            <div>
              <span className="admin-dashboard-footer-label">Pending</span>
              <strong>{stats.pending}</strong>
            </div>
            <div>
              <span className="admin-dashboard-footer-label">Under review</span>
              <strong>{stats.receiptSubmitted}</strong>
            </div>
            <div>
              <span className="admin-dashboard-footer-label">Rejected</span>
              <strong>{stats.rejected}</strong>
            </div>
          </div>
        </section>

        <section className="admin-dashboard-card admin-dashboard-card--wide">
          <div className="admin-dashboard-card-head">
            <div>
              <h2 className="admin-dashboard-card-title">Registration Categories</h2>
              <p className="admin-dashboard-card-desc">Participants grouped by fee category</p>
            </div>
          </div>
          {registrationsByCategory.length === 0 ? (
            <p className="admin-muted mb-0">No registrations yet.</p>
          ) : (
            <AdminHorizontalBarChart data={registrationsByCategory} />
          )}
        </section>

        <section className="admin-dashboard-card admin-dashboard-card--wide">
          <div className="admin-dashboard-card-head">
            <div>
              <h2 className="admin-dashboard-card-title">Latest Registrations</h2>
              <p className="admin-dashboard-card-desc">Most recent participant submissions</p>
            </div>
            <Link href="/admin/participants" className="admin-link">
              View all →
            </Link>
          </div>

          {data.recentRegistrations.length === 0 ? (
            <p className="admin-muted mb-0">No registrations yet.</p>
          ) : (
            <div className="admin-dashboard-list">
              {data.recentRegistrations.map((registration) => (
                <div key={registration.id} className="admin-dashboard-list-item">
                  <div className="admin-dashboard-list-user">
                    <span className="admin-dashboard-avatar" aria-hidden="true">
                      {getParticipantInitials(registration)}
                    </span>
                    <div>
                      <p className="admin-dashboard-list-name">
                        {formatParticipantName(registration)}
                      </p>
                      <p className="admin-dashboard-list-meta">{registration.referenceNumber}</p>
                    </div>
                  </div>
                  <div className="admin-dashboard-list-side">
                    <PaymentStatusBadge status={registration.paymentStatus} />
                    <span className="admin-dashboard-list-date">
                      {new Date(registration.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-dashboard-card admin-dashboard-card--full admin-table-wrap">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-dashboard-card-title mb-1">Recent Events</h2>
              <p className="admin-dashboard-card-desc mb-0">Quick access to event management</p>
            </div>
            <Link href="/admin/events" className="admin-link">
              View all →
            </Link>
          </div>

          {data.events.length === 0 ? (
            <p className="admin-muted p-3 mb-0">
              No events yet.{" "}
              <Link href="/admin/events/new" className="admin-link">
                Create your first event
              </Link>
              .
            </p>
          ) : (
            <AdminEventsTable events={data.events} limit={5} />
          )}
        </section>
      </div>
    </div>
  );
}
