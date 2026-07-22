import { NextResponse } from "next/server";
import { getEvaluationFormConfig, saveEvaluationFormConfig } from "@/lib/evaluation-config";
import { getEvaluationStats } from "@/lib/evaluation-stats";
import type { EvaluationQuestion } from "@/lib/types/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const [form, stats] = await Promise.all([
    getEvaluationFormConfig(),
    getEvaluationStats(eventId),
  ]);

  return NextResponse.json({ form, stats });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title : "";
    const description = typeof body.description === "string" ? body.description : "";
    const questions = Array.isArray(body.questions) ? (body.questions as EvaluationQuestion[]) : [];

    const form = await saveEvaluationFormConfig({ title, description, questions });
    return NextResponse.json({ form });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save evaluation form.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
