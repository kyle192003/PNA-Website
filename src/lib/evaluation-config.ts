import "server-only";

import { v4 as uuidv4 } from "uuid";
import { readJsonDocument, writeJsonDocument } from "@/lib/json-store";
import type { EvaluationFormConfig, EvaluationQuestion } from "@/lib/types/admin";

const EVALUATION_FILENAME = "evaluation-form.json";

export const DEFAULT_EVALUATION_FORM: EvaluationFormConfig = {
  title: "Event Evaluation",
  description: "Thank you for joining the event. Please answer this short evaluation.",
  questions: [
    {
      id: "overall-rating",
      label: "Overall rating",
      type: "rating",
      required: true,
    },
    {
      id: "feedback",
      label: "Feedback",
      type: "textarea",
      required: false,
    },
  ],
  updatedAt: new Date(0).toISOString(),
};

function normalizeQuestion(raw: EvaluationQuestion): EvaluationQuestion {
  return {
    id: raw.id || uuidv4(),
    label: raw.label?.trim() ?? "Question",
    type: raw.type ?? "text",
    required: Boolean(raw.required),
    options:
      raw.type === "select"
        ? (raw.options ?? []).map((option) => option.trim()).filter(Boolean)
        : undefined,
  };
}

export async function getEvaluationFormConfig(): Promise<EvaluationFormConfig> {
  const parsed = await readJsonDocument<EvaluationFormConfig>(
    EVALUATION_FILENAME,
    DEFAULT_EVALUATION_FORM
  );
  return {
    title: parsed.title?.trim() || DEFAULT_EVALUATION_FORM.title,
    description: parsed.description?.trim() || DEFAULT_EVALUATION_FORM.description,
    questions: (parsed.questions ?? DEFAULT_EVALUATION_FORM.questions).map(normalizeQuestion),
    updatedAt: parsed.updatedAt ?? DEFAULT_EVALUATION_FORM.updatedAt,
  };
}

export async function saveEvaluationFormConfig(
  input: Pick<EvaluationFormConfig, "title" | "description" | "questions">
): Promise<EvaluationFormConfig> {
  const questions = input.questions.map(normalizeQuestion);
  if (questions.length === 0) {
    throw new Error("Add at least one evaluation question.");
  }

  const config: EvaluationFormConfig = {
    title: input.title.trim() || DEFAULT_EVALUATION_FORM.title,
    description: input.description.trim() || DEFAULT_EVALUATION_FORM.description,
    questions,
    updatedAt: new Date().toISOString(),
  };

  await writeJsonDocument(EVALUATION_FILENAME, config);
  return config;
}
