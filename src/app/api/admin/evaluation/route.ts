import { NextResponse } from "next/server";
import { getEvaluationFormConfig, saveEvaluationFormConfig } from "@/lib/evaluation-config";
import { getEvaluationStats } from "@/lib/evaluation-stats";
import type { EvaluationQuestion } from "@/lib/types/admin";
import { requireAdminSession } from "@/lib/security/require-admin";
import { readJsonBody } from "@/lib/security/safe-input";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const [form, stats] = await Promise.all([
    getEvaluationFormConfig(),
    getEvaluationStats(eventId),
  ]);

  return NextResponse.json({ form, stats });
}

export async function PUT(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  try {
    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const title = typeof parsed.data.title === "string" ? parsed.data.title : "";
    const description =
      typeof parsed.data.description === "string" ? parsed.data.description : "";
    const questions = Array.isArray(parsed.data.questions)
      ? (parsed.data.questions as EvaluationQuestion[])
      : [];

    const form = await saveEvaluationFormConfig({ title, description, questions });
    return NextResponse.json({ form });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save evaluation form.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
