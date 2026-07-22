import type { DashboardChartPoint } from "@/lib/dashboard-chart";
import type { RegistrationRecord } from "@/lib/types/admin";

export type FinancialStats = {
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  paidCount: number;
  pendingCount: number;
  underReviewCount: number;
  averageTicket: number;
  revenueByCategory: DashboardChartPoint[];
  revenueByStatus: DashboardChartPoint[];
  registrationsByDay: DashboardChartPoint[];
  collectedByDay: DashboardChartPoint[];
  recentPaid: RegistrationRecord[];
};

export type ParticipantInsightStats = {
  total: number;
  paid: number;
  pending: number;
  underReview: number;
  checkedIn: number;
  byCategory: DashboardChartPoint[];
  byStatus: DashboardChartPoint[];
  byDay: DashboardChartPoint[];
};
