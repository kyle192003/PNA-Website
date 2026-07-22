"use client";

import { FormEvent, useMemo, useState } from "react";
import type { EvaluationFormConfig, EvaluationQuestion } from "@/lib/types/admin";
import { EvaluationThankYouModal } from "@/components/EvaluationThankYouModal";
import { PnaSelect } from "@/components/ui/PnaSelect";

type FormState = Record<string, string>;

function cleanQuestionLabel(label: string): string {
  return label.replace(/\s*\(optional\)\s*$/i, "").trim();
}

function questionLabel(question: EvaluationQuestion): string {
  const base = cleanQuestionLabel(question.label);
  return question.required ? base : `${base} (optional)`;
}

function EvaluationFormIcon() {
  return (
    <div className="evaluation-card-icon" aria-hidden="true">
      <span className="evaluation-card-icon-dot evaluation-card-icon-dot--a" />
      <span className="evaluation-card-icon-dot evaluation-card-icon-dot--b" />
      <span className="evaluation-card-icon-dot evaluation-card-icon-dot--c" />
      <svg viewBox="0 0 64 64" fill="none">
        <rect x="14" y="10" width="28" height="36" rx="4" stroke="currentColor" strokeWidth="2.5" />
        <rect
          x="22"
          y="18"
          width="28"
          height="36"
          rx="4"
          fill="#ecfdf5"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M30 30H42M30 38H38"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function renderQuestion(
  question: EvaluationQuestion,
  value: string,
  onChange: (id: string, next: string) => void,
  disabled: boolean,
  hasError: boolean
) {
  const fieldClass = `evaluation-field${hasError ? " evaluation-field--error" : ""}`;

  if (question.type === "rating") {
    return (
      <PnaSelect
        id={question.id}
        value={value}
        onChange={(next) => onChange(question.id, next)}
        disabled={disabled}
        required={question.required}
        placeholder="Select rating"
        className={fieldClass}
        options={[
          { value: "", label: "Select rating" },
          { value: "5", label: "5 - Excellent" },
          { value: "4", label: "4 - Very Good" },
          { value: "3", label: "3 - Good" },
          { value: "2", label: "2 - Fair" },
          { value: "1", label: "1 - Needs Improvement" },
        ]}
      />
    );
  }

  if (question.type === "select") {
    return (
      <PnaSelect
        id={question.id}
        value={value}
        onChange={(next) => onChange(question.id, next)}
        disabled={disabled}
        required={question.required}
        placeholder="Select an option"
        className={fieldClass}
        options={[
          { value: "", label: "Select an option" },
          ...(question.options ?? []).map((option) => ({
            value: option,
            label: option,
          })),
        ]}
      />
    );
  }

  if (question.type === "textarea") {
    return (
      <textarea
        id={question.id}
        className={`evaluation-input evaluation-textarea ${fieldClass}`}
        rows={4}
        value={value}
        onChange={(e) => onChange(question.id, e.target.value)}
        disabled={disabled}
        required={question.required}
        placeholder={cleanQuestionLabel(question.label)}
      />
    );
  }

  return (
    <input
      id={question.id}
      type="text"
      className={`evaluation-input ${fieldClass}`}
      value={value}
      onChange={(e) => onChange(question.id, e.target.value)}
      disabled={disabled}
      required={question.required}
      placeholder={cleanQuestionLabel(question.label)}
    />
  );
}

export function EvaluationForm({
  formConfig,
  token,
}: {
  formConfig: EvaluationFormConfig;
  token: string;
}) {
  const initialAnswers = useMemo(() => {
    const initial: FormState = {};
    for (const question of formConfig.questions) {
      initial[question.id] = "";
    }
    return initial;
  }, [formConfig.questions]);

  const [answers, setAnswers] = useState<FormState>(initialAnswers);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanksOpen, setThanksOpen] = useState(false);
  const [thanksMessage, setThanksMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function updateAnswer(id: string, next: string) {
    setAnswers((current) => ({ ...current, [id]: next }));
    setFieldErrors((current) => {
      if (!current[id]) return current;
      const nextErrors = { ...current };
      delete nextErrors[id];
      return nextErrors;
    });
  }

  function validateClient(): boolean {
    const nextErrors: Record<string, string> = {};
    for (const question of formConfig.questions) {
      const value = (answers[question.id] ?? "").trim();
      if (question.required && !value) {
        nextErrors[question.id] = "Please fill the required field.";
      }
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid evaluation link. Please use the link sent in your email.");
      return;
    }

    if (!validateClient()) {
      setError("Please fill the required field.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/evaluation/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answers }),
      });
      const data = (await response.json()) as {
        message?: string;
        error?: string;
        certificateStatus?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Unable to submit evaluation.");
        return;
      }

      const certificateNote =
        data.certificateStatus === "sent"
          ? " Your certificate has been sent to your email."
          : data.certificateStatus === "failed"
            ? " Your response was saved. Certificate email could not be sent yet."
            : " Your response was saved.";

      setThanksMessage(
        `${data.message ?? "Thank you for submitting your evaluation."}${certificateNote}`
      );
      setSubmitted(true);
      setThanksOpen(true);
    } catch {
      setError("Unable to submit evaluation right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="evaluation-page">
        <div className="evaluation-card">
          <EvaluationFormIcon />
          <h1 className="evaluation-card-title font-display">{formConfig.title}</h1>
          <p className="evaluation-card-desc">{formConfig.description}</p>

          {submitted ? (
            <p className="evaluation-card-done">
              You have already submitted this evaluation. You can close this page.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="evaluation-form" noValidate>
              {formConfig.questions.map((question) => {
                const hasError = Boolean(fieldErrors[question.id]);
                return (
                  <div key={question.id} className="evaluation-field-group">
                    <label className="evaluation-label" htmlFor={question.id}>
                      {questionLabel(question)}
                      {question.required ? <span className="evaluation-required">*</span> : null}
                    </label>
                    {renderQuestion(
                      question,
                      answers[question.id] ?? "",
                      updateAnswer,
                      submitting,
                      hasError
                    )}
                    {hasError ? (
                      <p className="evaluation-field-error">{fieldErrors[question.id]}</p>
                    ) : null}
                  </div>
                );
              })}

              {error ? (
                <p className="evaluation-form-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="evaluation-form-footer">
                <button
                  type="submit"
                  className="btn-pill-arrow evaluation-submit"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <EvaluationThankYouModal
        open={thanksOpen}
        onClose={() => setThanksOpen(false)}
        message={thanksMessage}
      />
    </>
  );
}
