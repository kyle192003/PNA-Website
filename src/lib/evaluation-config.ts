import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { EvaluationFormConfig, EvaluationQuestion } from "@/lib/types/admin";

const DATA_FILE = path.join(process.cwd(), "data", "evaluation-form.json");

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

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_EVALUATION_FORM, null, 2), "utf-8");
  }
}

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
  await ensureDataFile();
  const content = await fs.readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(content) as EvaluationFormConfig;
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
  await ensureDataFile();
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

  await fs.writeFile(DATA_FILE, JSON.stringify(config, null, 2), "utf-8");
  return config;
}
