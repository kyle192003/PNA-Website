import { NextResponse } from "next/server";
import { runAccountantWeeklyShareJob } from "@/lib/accountant-weekly-send";
import { cronSecretMatches } from "@/lib/security/server-env";

function authorizeCron(request: Request): boolean {
  return cronSecretMatches(request.headers.get("authorization"));
}

async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runAccountantWeeklyShareJob();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Accountant share job failed.";
    console.error("[cron/accountant-share]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
