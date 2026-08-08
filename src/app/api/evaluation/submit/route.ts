import { NextResponse } from "next/server";
import { getEvaluationFormConfig } from "@/lib/evaluation-config";
import { getEventById } from "@/lib/events";
import { extractCheckInTokenFromScan } from "@/lib/check-in-qr";
import { sendCertificateEmail } from "@/lib/mail-templates";
import {
  getRegistrationByCheckInToken,
  markCertificateSent,
  submitRegistrationEvaluation,
} from "@/lib/registrations";

function validateAnswers(
  answers: Record<string, string | number>,
  form: Awaited<ReturnType<typeof getEvaluationFormConfig>>
): string | null {
  for (const question of form.questions) {
    const value = answers[question.id];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim()) ||
      (question.type === "rating" && !Number.isFinite(Number(value)));

    if (question.required && empty) {
      return `${question.label} is required.`;
    }

    if (question.type === "rating" && value !== undefined && value !== "") {
      const rating = Number(value);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return `${question.label} must be between 1 and 5.`;
      }
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = extractCheckInTokenFromScan(typeof body.token === "string" ? body.token : "");
    const rawAnswers =
      body.answers && typeof body.answers === "object"
        ? (body.answers as Record<string, string | number>)
        : {
            "overall-rating": body.rating,
            feedback: body.feedback,
          };

    if (!token) {
      return NextResponse.json({ error: "Invalid evaluation token." }, { status: 400 });
    }

    const form = await getEvaluationFormConfig();
    const validationError = validateAnswers(rawAnswers, form);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const registration = await getRegistrationByCheckInToken(token);
    if (!registration) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }
    if (!registration.eventId) {
      return NextResponse.json(
        { error: "Event record is missing for this participant." },
        { status: 400 }
      );
    }
    if (registration.evaluationSubmittedAt) {
      return NextResponse.json(
        { error: "This evaluation has already been submitted." },
        { status: 409 }
      );
    }
    if (registration.paymentStatus !== "paid") {
      return NextResponse.json(
        { error: "Evaluation is available after payment has been confirmed." },
        { status: 403 }
      );
    }

    const updated = await submitRegistrationEvaluation(registration.id, rawAnswers);
    if (!updated) {
      return NextResponse.json({ error: "Unable to save evaluation." }, { status: 500 });
    }

    let certificateStatus: "sent" | "skipped" | "failed" = "skipped";
    let certificateError: string | undefined;

    if (!registration.certificateSentAt) {
      const event = await getEventById(registration.eventId);
      if (event) {
        const sent = await sendCertificateEmail(updated, event);
        if (sent.ok) {
          await markCertificateSent(registration.id);
          certificateStatus = "sent";
        } else {
          certificateStatus = "failed";
          certificateError = sent.error;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Thank you for submitting your evaluation.",
      certificateStatus,
      certificateError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evaluation submission failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
