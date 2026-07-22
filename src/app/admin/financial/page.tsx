import Link from "next/link";
import { AdminBillInsights } from "@/components/admin/AdminBillInsights";
import { AdminExportMenu } from "@/components/admin/AdminExportMenu";
import {
  AdminHorizontalBarChart,
} from "@/components/admin/dashboard/AdminBarCharts";
import { formatPeso, getFinancialStats } from "@/lib/financial-stats";
import { getAllEvents } from "@/lib/events";
import { conference } from "@/lib/conference";
import { formatParticipantName } from "@/lib/participant-name";
import { PAYMENT_STATUS_LABELS } from "@/lib/types/admin";

export default async function AdminFinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { eventId } = await searchParams;
  const events = await getAllEvents();
  const selectedEventId =
    eventId && events.some((event) => event.id === eventId) ? eventId : events[0]?.id ?? "";
  const stats = await getFinancialStats(selectedEventId || null);
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const fees = selectedEvent?.fees ?? conference.registration.fees;

  return (
    <div className="admin-page admin-financial-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Financial</h1>
          <p className="admin-muted">
            Track expected fees, collected payments, and category revenue. Participants choose their
            payment amount during registration.
          </p>
        </div>
        <div className="admin-page-header-actions">
          <Link href="/admin/participants" className="btn-primary">
            Review payments
          </Link>
          <AdminExportMenu type="financial" eventId={selectedEventId || null} />
        </div>
      </div>

      {events.length > 0 ? (
        <div className="admin-financial-event-tabs">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/admin/financial?eventId=${encodeURIComponent(event.id)}`}
              className={`admin-financial-event-tab${
                event.id === selectedEventId ? " active" : ""
              }`}
            >
              {event.title}
            </Link>
          ))}
        </div>
      ) : null}

      <AdminBillInsights
        title="Payment overview"
        subtitle={selectedEvent?.title ?? "All events"}
        highlightLabel="Collected so far"
        highlightValue={formatPeso(stats.totalCollected)}
        highlightHint={`${stats.paidCount} paid participants`}
        metrics={[
          {
            label: "Expected revenue",
            value: formatPeso(stats.totalExpected),
            hint: "Based on chosen registration amounts",
          },
          {
            label: "Outstanding",
            value: formatPeso(stats.totalOutstanding),
            hint: "Not yet marked paid",
          },
          {
            label: "Average ticket",
            value: formatPeso(stats.averageTicket),
          },
          {
            label: "Under review",
            value: stats.underReviewCount,
            hint: "Receipts awaiting confirmation",
          },
        ]}
        chartTitle="Registrations this week"
        chartData={stats.registrationsByDay}
        chartMode="vertical"
        breakdownTitle="Bill computation summary"
        breakdown={[
          { label: "Paid collections", value: formatPeso(stats.totalCollected) },
          {
            label: PAYMENT_STATUS_LABELS.pending,
            value: formatPeso(
              stats.revenueByStatus.find((item) => item.label === PAYMENT_STATUS_LABELS.pending)
                ?.value ?? 0
            ),
          },
          {
            label: PAYMENT_STATUS_LABELS.receipt_submitted,
            value: formatPeso(
              stats.revenueByStatus.find(
                (item) => item.label === PAYMENT_STATUS_LABELS.receipt_submitted
              )?.value ?? 0
            ),
          },
          { label: "Total amount expected", value: formatPeso(stats.totalExpected) },
        ]}
      />

      <div className="admin-financial-secondary">
        <section className="admin-card admin-financial-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Revenue by category</h2>
              <p className="admin-muted mb-0">How much each registration type contributes</p>
            </div>
          </div>
          <div className="admin-financial-card-body">
            {stats.revenueByCategory.length === 0 ? (
              <p className="admin-muted mb-0">No payment data yet.</p>
            ) : (
              <AdminHorizontalBarChart
                data={stats.revenueByCategory}
                formatValue={formatPeso}
              />
            )}
          </div>
        </section>

        <section className="admin-card admin-financial-card">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title">Fee menu for this event</h2>
              <p className="admin-muted mb-0">
                Participants pick one of these amounts when they register
              </p>
            </div>
          </div>
          <div className="admin-financial-fee-grid">
            {Object.entries(fees).map(([key, fee]) => (
              <div key={key} className="admin-financial-fee-card">
                <p className="admin-financial-fee-label">{fee.label}</p>
                <p className="admin-financial-fee-amount">{formatPeso(fee.early)}</p>
                <p className="admin-financial-fee-meta">Early bird</p>
                <p className="admin-financial-fee-amount admin-financial-fee-amount--secondary">
                  {formatPeso(fee.regular)}
                </p>
                <p className="admin-financial-fee-meta">Regular</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Recent paid participants</h2>
            <p className="admin-muted mb-0">Latest confirmed collections</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          {stats.recentPaid.length === 0 ? (
            <p className="admin-muted p-3 mb-0">No paid participants yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Reference</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Tier</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentPaid.map((registration) => (
                  <tr key={registration.id}>
                    <td>{formatParticipantName(registration)}</td>
                    <td>{registration.referenceNumber}</td>
                    <td>
                      {conference.registration.fees[registration.category]?.label ??
                        registration.category}
                    </td>
                    <td>{formatPeso(registration.paymentAmount)}</td>
                    <td>{registration.feeTier === "regular" ? "Regular" : "Early bird"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
