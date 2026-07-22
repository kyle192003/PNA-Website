import { NextResponse } from "next/server";
import { getEvaluationFormConfig } from "@/lib/evaluation-config";

export async function GET() {
  const form = await getEvaluationFormConfig();
  return NextResponse.json({ form });
}
