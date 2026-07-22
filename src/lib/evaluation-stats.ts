import { getEvaluationFormConfig } from "@/lib/evaluation-config";
import { getAllRegistrations } from "@/lib/registrations";
import type { EvaluationQuestion, RegistrationRecord } from "@/lib/types/admin";

export type EvaluationStats = {
  totalInvites: number;
  totalResponses: number;
  responseRate: number;
  averageRating: number | null;
  ratingDistribution: Array<{ label: string; value: number }>;
  questionBreakdown: Array<{
    questionId: string;
    label: string;
    type: EvaluationQuestion["type"];
    answers: Array<{ label: string; value: number }>;
    textResponses: string[];
  }>;
  recentResponses: Array<{
    id: string;
    name: string;
    referenceNumber: string;
    rating: number | null;
    feedback: string;
    submittedAt: string;
  }>;
};

function getResponses(
  registrations: RegistrationRecord[],
  eventId?: string | null
): RegistrationRecord[] {
  return registrations.filter((registration) => {
    if (!registration.evaluationSubmittedAt) return false;
    if (eventId && registration.eventId !== eventId) return false;
    return true;
  });
}

export async function getEvaluationStats(eventId?: string | null): Promise<EvaluationStats> {
  const [form, registrations] = await Promise.all([
    getEvaluationFormConfig(),
    getAllRegistrations(),
  ]);

  const scoped = eventId
    ? registrations.filter((registration) => registration.eventId === eventId)
    : registrations;

  const invited = scoped.filter((registration) => registration.evaluationInviteSentAt);
  const responses = getResponses(registrations, eventId);

  const ratings = responses
    .map((registration) => registration.evaluationRating)
    .filter((rating): rating is number => typeof rating === "number");

  const ratingDistribution = [5, 4, 3, 2, 1].map((score) => ({
    label: String(score),
    value: ratings.filter((rating) => rating === score).length,
  }));

  const questionBreakdown = form.questions.map((question) => {
    if (question.type === "rating" || question.type === "select") {
      const options =
        question.type === "rating"
          ? ["5", "4", "3", "2", "1"]
          : (question.options ?? []);

      const counts = new Map<string, number>();
      for (const option of options) counts.set(option, 0);

      for (const registration of responses) {
        const answer = registration.evaluationAnswers?.[question.id];
        if (answer === undefined || answer === null || answer === "") continue;
        const key = String(answer);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      return {
        questionId: question.id,
        label: question.label,
        type: question.type,
        answers: Array.from(counts.entries()).map(([label, value]) => ({ label, value })),
        textResponses: [],
      };
    }

    const textResponses = responses
      .map((registration) => registration.evaluationAnswers?.[question.id])
      .filter((value): value is string | number => value !== undefined && value !== "")
      .map((value) => String(value));

    return {
      questionId: question.id,
      label: question.label,
      type: question.type,
      answers: [],
      textResponses: textResponses.slice(0, 12),
    };
  });

  return {
    totalInvites: invited.length,
    totalResponses: responses.length,
    responseRate: invited.length ? Math.round((responses.length / invited.length) * 100) : 0,
    averageRating: ratings.length
      ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
      : null,
    ratingDistribution,
    questionBreakdown,
    recentResponses: responses.slice(0, 10).map((registration) => ({
      id: registration.id,
      name: `${registration.lastName}, ${registration.firstName}`,
      referenceNumber: registration.referenceNumber,
      rating: registration.evaluationRating,
      feedback: registration.evaluationFeedback,
      submittedAt: registration.evaluationSubmittedAt ?? "",
    })),
  };
}
