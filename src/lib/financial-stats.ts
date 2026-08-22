import { conference } from "@/lib/conference";
import { buildDailySeries, type DashboardChartPoint } from "@/lib/dashboard-chart";
import type { FinancialStats, ParticipantInsightStats } from "@/lib/financial-types";
import { getAllRegistrations } from "@/lib/registrations";
import type { RegistrationRecord } from "@/lib/types/admin";
import { PAYMENT_STATUS_LABELS } from "@/lib/types/admin";

export type { FinancialStats, ParticipantInsightStats } from "@/lib/financial-types";
export { formatPeso } from "@/lib/registration-fees";

function sumAmounts(
  registrations: RegistrationRecord[],
  filter?: (registration: RegistrationRecord) => boolean
): number {
  return registrations
    .filter((registration) => (filter ? filter(registration) : true))
    .reduce((sum, registration) => sum + (registration.paymentAmount || 0), 0);
}

function countByDay(
  registrations: RegistrationRecord[],
  dayCount = 7,
  filter?: (registration: RegistrationRecord) => boolean
): DashboardChartPoint[] {
  const filtered = filter ? registrations.filter(filter) : registrations;
  return buildDailySeries(
    filtered.map((registration) => ({ at: registration.createdAt })),
    dayCount
  );
}

function collectedByDay(registrations: RegistrationRecord[], dayCount = 7): DashboardChartPoint[] {
  return buildDailySeries(
    registrations
      .filter((registration) => registration.paymentStatus === "paid")
      .map((registration) => ({
        at: registration.updatedAt,
        amount: registration.paymentAmount || 0,
      })),
    dayCount
  );
}

export async function getFinancialStats(eventId?: string | null): Promise<FinancialStats> {
  const registrations = await getAllRegistrations();
  const scoped = eventId
    ? registrations.filter((registration) => registration.eventId === eventId)
    : registrations;

  const paidLane = scoped.filter(
    (registration) =>
      registration.appliedFeeKey !== "committee" && registration.appliedFeeKey !== "speaker"
  );

  const paid = paidLane.filter((registration) => registration.paymentStatus === "paid");
  const pending = paidLane.filter((registration) => registration.paymentStatus === "pending");
  const underReview = paidLane.filter(
    (registration) => registration.paymentStatus === "receipt_submitted"
  );

  const totalExpected = sumAmounts(paidLane);
  const totalCollected = sumAmounts(paid);
  const totalOutstanding = Math.max(totalExpected - totalCollected, 0);

  const categoryMap = new Map<string, number>();
  for (const registration of paidLane) {
    const label =
      registration.feeLabel?.trim() ||
      (conference.registration.fees as Record<string, { label?: string }>)[registration.category]
        ?.label ||
      registration.category;
    categoryMap.set(label, (categoryMap.get(label) ?? 0) + (registration.paymentAmount || 0));
  }

  return {
    totalExpected,
    totalCollected,
    totalOutstanding,
    paidCount: paid.length,
    pendingCount: pending.length,
    underReviewCount: underReview.length,
    averageTicket: paidLane.length ? Math.round(totalExpected / paidLane.length) : 0,
    revenueByCategory: Array.from(categoryMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    revenueByStatus: [
      { label: PAYMENT_STATUS_LABELS.paid, value: totalCollected },
      {
        label: PAYMENT_STATUS_LABELS.pending,
        value: sumAmounts(pending),
      },
      {
        label: PAYMENT_STATUS_LABELS.receipt_submitted,
        value: sumAmounts(underReview),
      },
      {
        label: PAYMENT_STATUS_LABELS.rejected,
        value: sumAmounts(scoped, (registration) => registration.paymentStatus === "rejected"),
      },
    ],
    registrationsByDay: countByDay(scoped),
    collectedByDay: collectedByDay(scoped),
    recentPaid: paid.slice(0, 8),
  };
}

export async function getParticipantInsightStats(
  eventId?: string | null
): Promise<ParticipantInsightStats> {
  const registrations = await getAllRegistrations();
  const scoped = eventId
    ? registrations.filter((registration) =>
        eventId === "unassigned" ? !registration.eventId : registration.eventId === eventId
      )
    : registrations;

  const categoryMap = new Map<string, number>();
  for (const registration of scoped) {
    const label =
      registration.feeLabel?.trim() ||
      (conference.registration.fees as Record<string, { label?: string }>)[registration.category]
        ?.label ||
      registration.category;
    categoryMap.set(label, (categoryMap.get(label) ?? 0) + 1);
  }

  return {
    total: scoped.length,
    paid: scoped.filter((registration) => registration.paymentStatus === "paid").length,
    pending: scoped.filter((registration) => registration.paymentStatus === "pending").length,
    underReview: scoped.filter(
      (registration) => registration.paymentStatus === "receipt_submitted"
    ).length,
    checkedIn: scoped.filter((registration) => registration.checkInStatus === "checked_in")
      .length,
    byCategory: Array.from(categoryMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    byStatus: [
      {
        label: PAYMENT_STATUS_LABELS.paid,
        value: scoped.filter((registration) => registration.paymentStatus === "paid").length,
      },
      {
        label: PAYMENT_STATUS_LABELS.pending,
        value: scoped.filter((registration) => registration.paymentStatus === "pending").length,
      },
      {
        label: PAYMENT_STATUS_LABELS.receipt_submitted,
        value: scoped.filter((registration) => registration.paymentStatus === "receipt_submitted")
          .length,
      },
      {
        label: PAYMENT_STATUS_LABELS.rejected,
        value: scoped.filter((registration) => registration.paymentStatus === "rejected").length,
      },
    ],
    byDay: countByDay(scoped),
  };
}
