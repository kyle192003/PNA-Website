import { conference } from "@/lib/conference";
import { getEvaluationFormConfig } from "@/lib/evaluation-config";
import { getEvaluationStats } from "@/lib/evaluation-stats";
import { getEventById } from "@/lib/events";
import {
  getFinancialStats,
  getParticipantInsightStats,
} from "@/lib/financial-stats";
import { formatPeso } from "@/lib/registration-fees";
import { formatParticipantName } from "@/lib/participant-name";
import { getAllRegistrations } from "@/lib/registrations";
import { PAYMENT_STATUS_LABELS, type RegistrationRecord } from "@/lib/types/admin";
import type { ExportReport } from "@/lib/export/types";

function scopeRegistrations(
  registrations: RegistrationRecord[],
  eventId?: string | null
): RegistrationRecord[] {
  if (!eventId) return registrations;
  if (eventId === "unassigned") {
    return registrations.filter((registration) => !registration.eventId);
  }
  return registrations.filter((registration) => registration.eventId === eventId);
}

async function resolveEventLabel(eventId?: string | null): Promise<string> {
  if (!eventId) return "All events";
  if (eventId === "unassigned") return "Unassigned";
  const event = await getEventById(eventId);
  return event?.title ?? "Selected event";
}

function categoryLabel(category: RegistrationRecord["category"] | string, feeLabel?: string): string {
  if (feeLabel?.trim()) return feeLabel;
  const fees = conference.registration.fees as Record<string, { label?: string }>;
  return fees[category]?.label ?? String(category);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function buildFinancialExport(
  eventId?: string | null
): Promise<ExportReport> {
  const [stats, registrations, eventLabel] = await Promise.all([
    getFinancialStats(eventId),
    getAllRegistrations(),
    resolveEventLabel(eventId),
  ]);
  const scoped = scopeRegistrations(registrations, eventId);

  return {
    type: "financial",
    title: "Financial Report",
    eventLabel,
    exportedAt: new Date().toISOString(),
    highlightLabel: "Collected so far",
    highlightValue: formatPeso(stats.totalCollected),
    summary: [
      { label: "Expected revenue", value: formatPeso(stats.totalExpected) },
      { label: "Collected", value: formatPeso(stats.totalCollected) },
      { label: "Outstanding", value: formatPeso(stats.totalOutstanding) },
      { label: "Average ticket", value: formatPeso(stats.averageTicket) },
      { label: "Paid participants", value: stats.paidCount },
      { label: "Pending participants", value: stats.pendingCount },
      { label: "Under review", value: stats.underReviewCount },
    ],
    breakdownTitle: "Revenue by status / category",
    breakdown: [
      ...stats.revenueByStatus.map((item) => ({
        label: `Status: ${item.label}`,
        value: formatPeso(item.value),
      })),
      ...stats.revenueByCategory.map((item) => ({
        label: `Category: ${item.label}`,
        value: formatPeso(item.value),
      })),
    ],
    charts: [
      {
        title: "Revenue by Payment Status",
        subtitle: "Peso value grouped by payment state",
        kind: "bar",
        valuePrefix: "PHP ",
        points: stats.revenueByStatus,
      },
      {
        title: "Revenue by Category",
        subtitle: "Expected revenue by registration category",
        kind: "bar",
        valuePrefix: "PHP ",
        points: stats.revenueByCategory,
      },
      {
        title: "Collections Trend",
        subtitle: "Paid collections by day",
        kind: "line",
        valuePrefix: "PHP ",
        points: stats.collectedByDay,
      },
      {
        title: "Registration Trend",
        subtitle: "Registrations received by day",
        kind: "line",
        points: stats.registrationsByDay,
      },
    ],
    detailHeaders: [
      "Reference",
      "Name",
      "Email",
      "Category",
      "Fee tier",
      "Amount",
      "Payment status",
      "Registered",
      "Updated",
    ],
    detailRows: scoped.map((registration) => [
      registration.referenceNumber,
      formatParticipantName(registration),
      registration.email,
      categoryLabel(registration.category, registration.feeLabel),
      registration.feeTier === "regular" ? "Regular" : "Early bird",
      formatPeso(registration.paymentAmount ?? 0),
      PAYMENT_STATUS_LABELS[registration.paymentStatus],
      formatDate(registration.createdAt),
      formatDate(registration.updatedAt),
    ]),
  };
}

export async function buildApprovedParticipantsExport(
  eventId?: string | null
): Promise<ExportReport> {
  const [stats, registrations, eventLabel] = await Promise.all([
    getFinancialStats(eventId),
    getAllRegistrations(),
    resolveEventLabel(eventId),
  ]);
  const scoped = scopeRegistrations(registrations, eventId).filter(
    (registration) => registration.paymentStatus === "paid"
  );

  const categoryMap = new Map<string, number>();
  const categoryCountMap = new Map<string, number>();
  for (const registration of scoped) {
    const label = categoryLabel(registration.category, registration.feeLabel);
    categoryMap.set(label, (categoryMap.get(label) ?? 0) + (registration.paymentAmount || 0));
    categoryCountMap.set(label, (categoryCountMap.get(label) ?? 0) + 1);
  }

  const revenueByCategory = Array.from(categoryMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const countByCategory = Array.from(categoryCountMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    type: "approved-participants",
    title: "Approved Participants Report",
    eventLabel,
    exportedAt: new Date().toISOString(),
    highlightLabel: "Collected from approved",
    highlightValue: formatPeso(stats.totalCollected),
    summary: [
      { label: "Approved participants", value: stats.paidCount },
      { label: "Total collected", value: formatPeso(stats.totalCollected) },
      { label: "Average ticket (all registered)", value: formatPeso(stats.averageTicket) },
      { label: "Outstanding (not approved)", value: formatPeso(stats.totalOutstanding) },
    ],
    breakdownTitle: "Approved revenue by category",
    breakdown: revenueByCategory.map((item) => ({
      label: item.label,
      value: formatPeso(item.value),
    })),
    charts: [
      {
        title: "Approved Revenue by Category",
        subtitle: "Collected peso value for paid participants only",
        kind: "bar",
        valuePrefix: "PHP ",
        points: revenueByCategory,
      },
      {
        title: "Approved Participants by Category",
        subtitle: "Headcount of paid participants",
        kind: "bar",
        points: countByCategory,
      },
      {
        title: "Collections Trend",
        subtitle: "Paid collections by day",
        kind: "line",
        valuePrefix: "PHP ",
        points: stats.collectedByDay,
      },
    ],
    detailHeaders: [
      "Reference",
      "Name",
      "Email",
      "Phone",
      "Organization",
      "Category",
      "Fee tier",
      "Amount",
      "Payment reference",
      "Approved / updated",
      "Registered",
    ],
    detailRows: scoped.map((registration) => [
      registration.referenceNumber,
      formatParticipantName(registration),
      registration.email,
      registration.phone,
      registration.organization,
      categoryLabel(registration.category, registration.feeLabel),
      registration.specialRole
        ? "Complimentary"
        : registration.feeTier === "regular"
          ? "Regular"
          : "Early bird",
      formatPeso(registration.paymentAmount ?? 0),
      registration.paymentReference || "",
      formatDate(registration.updatedAt),
      formatDate(registration.createdAt),
    ]),
  };
}

export async function buildParticipantsExport(
  eventId?: string | null
): Promise<ExportReport> {
  const [stats, registrations, eventLabel] = await Promise.all([
    getParticipantInsightStats(eventId),
    getAllRegistrations(),
    resolveEventLabel(eventId),
  ]);
  const scoped = scopeRegistrations(registrations, eventId);

  return {
    type: "participants",
    title: "Participants Report",
    eventLabel,
    exportedAt: new Date().toISOString(),
    highlightLabel: "Total registered",
    highlightValue: String(stats.total),
    summary: [
      { label: "Total registered", value: stats.total },
      { label: "Paid", value: stats.paid },
      { label: "Pending", value: stats.pending },
      { label: "Under review", value: stats.underReview },
      { label: "Checked in", value: stats.checkedIn },
    ],
    breakdownTitle: "By status / category",
    breakdown: [
      ...stats.byStatus.map((item) => ({
        label: `Status: ${item.label}`,
        value: item.value,
      })),
      ...stats.byCategory.map((item) => ({
        label: `Category: ${item.label}`,
        value: item.value,
      })),
    ],
    charts: [
      {
        title: "Participants by Payment Status",
        subtitle: "Registration count grouped by payment state",
        kind: "bar",
        points: stats.byStatus,
      },
      {
        title: "Participants by Category",
        subtitle: "Registration count by delegate category",
        kind: "bar",
        points: stats.byCategory,
      },
      {
        title: "Registration Trend",
        subtitle: "Registrations received by day",
        kind: "line",
        points: stats.byDay,
      },
    ],
    detailHeaders: [
      "Reference",
      "Name",
      "Email",
      "Phone",
      "Organization",
      "Position",
      "Category",
      "Special role",
      "Amount",
      "Fee tier",
      "Payment status",
      "Check-in",
      "Checked in at",
      "Registered",
    ],
    detailRows: scoped.map((registration) => [
      registration.referenceNumber,
      formatParticipantName(registration),
      registration.email,
      registration.phone,
      registration.organization,
      registration.position,
      categoryLabel(registration.category, registration.feeLabel),
      registration.specialRole === "committee"
        ? "Committee"
        : registration.specialRole === "speaker"
          ? "Speaker"
          : "",
      formatPeso(registration.paymentAmount ?? 0),
      registration.specialRole
        ? "Complimentary"
        : registration.feeTier === "regular"
          ? "Regular"
          : "Early bird",
      PAYMENT_STATUS_LABELS[registration.paymentStatus],
      registration.checkInStatus === "checked_in" ? "Checked in" : "Pending",
      formatDate(registration.checkedInAt),
      formatDate(registration.createdAt),
    ]),
  };
}

export async function buildEvaluationExport(
  eventId?: string | null
): Promise<ExportReport> {
  const [stats, form, registrations, eventLabel] = await Promise.all([
    getEvaluationStats(eventId),
    getEvaluationFormConfig(),
    getAllRegistrations(),
    resolveEventLabel(eventId),
  ]);

  const responses = registrations.filter((registration) => {
    if (!registration.evaluationSubmittedAt) return false;
    if (!eventId) return true;
    return registration.eventId === eventId;
  });

  const questionHeaders = form.questions.map((question) => question.label);

  return {
    type: "evaluation",
    title: "Evaluation Report",
    eventLabel,
    exportedAt: new Date().toISOString(),
    highlightLabel: "Response rate",
    highlightValue: `${stats.responseRate}%`,
    summary: [
      { label: "Invites sent", value: stats.totalInvites },
      { label: "Responses", value: stats.totalResponses },
      { label: "Response rate", value: `${stats.responseRate}%` },
      {
        label: "Average rating",
        value: stats.averageRating ?? "N/A",
      },
    ],
    breakdownTitle: "Rating distribution / question totals",
    breakdown: [
      ...stats.ratingDistribution.map((item) => ({
        label: `${item.label} star${item.label === "1" ? "" : "s"}`,
        value: item.value,
      })),
      ...stats.questionBreakdown
        .filter((question) => question.answers.length > 0)
        .flatMap((question) =>
          question.answers.map((answer) => ({
            label: `${question.label}: ${answer.label}`,
            value: answer.value,
          }))
        ),
    ],
    charts: [
      {
        title: "Rating Distribution",
        subtitle: "Submitted evaluation ratings",
        kind: "bar",
        points: stats.ratingDistribution.map((item) => ({
          label: `${item.label} star${item.label === "1" ? "" : "s"}`,
          value: item.value,
        })),
      },
      {
        title: "Evaluation Completion",
        subtitle: "Invites sent compared with submitted responses",
        kind: "bar",
        valueSuffix: "%",
        points: [
          { label: "Invites", value: stats.totalInvites },
          { label: "Responses", value: stats.totalResponses },
          { label: "Response rate", value: stats.responseRate },
        ],
      },
      ...stats.questionBreakdown
        .filter((question) => question.answers.length > 0)
        .slice(0, 2)
        .map((question) => ({
          title: question.label,
          subtitle: "Question answer distribution",
          kind: "bar" as const,
          points: question.answers,
        })),
    ],
    detailHeaders: [
      "Reference",
      "Name",
      "Rating",
      "Feedback",
      "Submitted",
      ...questionHeaders,
    ],
    detailRows: responses.map((registration) => [
      registration.referenceNumber,
      formatParticipantName(registration),
      registration.evaluationRating ?? "",
      registration.evaluationFeedback ?? "",
      formatDate(registration.evaluationSubmittedAt),
      ...form.questions.map((question) => {
        const answer = registration.evaluationAnswers?.[question.id];
        return answer === undefined || answer === null ? "" : String(answer);
      }),
    ]),
  };
}
