import { conference } from "@/lib/conference";
import type { DashboardChartPoint } from "@/lib/dashboard-chart";
import { getAllEvents } from "@/lib/events";
import { getAllRegistrations, getAdminStats } from "@/lib/registrations";
import type { AdminStats, RegistrationRecord } from "@/lib/types/admin";
import { PAYMENT_STATUS_LABELS } from "@/lib/types/admin";

export type { DashboardChartPoint } from "@/lib/dashboard-chart";

export interface AdminDashboardData {
  stats: AdminStats;
  registrationsByDay: DashboardChartPoint[];
  paidByDay: DashboardChartPoint[];
  pendingByDay: DashboardChartPoint[];
  reviewByDay: DashboardChartPoint[];
  paymentStatusBreakdown: DashboardChartPoint[];
  registrationsByCategory: DashboardChartPoint[];
  recentRegistrations: RegistrationRecord[];
  events: Awaited<ReturnType<typeof getAllEvents>>;
}

function getRegistrationsByDay(
  registrations: RegistrationRecord[],
  dayCount = 7,
  filter?: (registration: RegistrationRecord) => boolean
): DashboardChartPoint[] {
  const filtered = filter ? registrations.filter(filter) : registrations;
  const points: DashboardChartPoint[] = [];

  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);

    const key = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString("en-US", { weekday: "short" });

    points.push({
      label,
      value: filtered.filter((registration) => registration.createdAt.startsWith(key)).length,
    });
  }

  return points;
}

function getPaymentStatusBreakdown(stats: AdminStats): DashboardChartPoint[] {
  return [
    { label: PAYMENT_STATUS_LABELS.paid, value: stats.paid },
    { label: PAYMENT_STATUS_LABELS.pending, value: stats.pending },
    { label: PAYMENT_STATUS_LABELS.receipt_submitted, value: stats.receiptSubmitted },
    { label: PAYMENT_STATUS_LABELS.receipt_issue, value: stats.receiptIssue },
    { label: PAYMENT_STATUS_LABELS.rejected, value: stats.rejected },
  ];
}

function getRegistrationsByCategory(
  registrations: RegistrationRecord[]
): DashboardChartPoint[] {
  const counts = new Map<string, number>();

  for (const registration of registrations) {
    const label = conference.registration.fees[registration.category]?.label ?? registration.category;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [stats, registrations, events] = await Promise.all([
    getAdminStats(),
    getAllRegistrations(),
    getAllEvents(),
  ]);

  return {
    stats,
    registrationsByDay: getRegistrationsByDay(registrations),
    paidByDay: getRegistrationsByDay(registrations, 7, (registration) => registration.paymentStatus === "paid"),
    pendingByDay: getRegistrationsByDay(registrations, 7, (registration) => registration.paymentStatus === "pending"),
    reviewByDay: getRegistrationsByDay(
      registrations,
      7,
      (registration) => registration.paymentStatus === "receipt_submitted"
    ),
    paymentStatusBreakdown: getPaymentStatusBreakdown(stats),
    registrationsByCategory: getRegistrationsByCategory(registrations),
    recentRegistrations: registrations.slice(0, 6),
    events,
  };
}
