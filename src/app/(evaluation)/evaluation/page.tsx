"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EvaluationFormConfig } from "@/lib/types/admin";
import { EvaluationForm } from "@/components/EvaluationForm";

function EvaluationPageInner() {
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get("t") ?? searchParams.get("token") ?? "",
    [searchParams]
  );
  const [formConfig, setFormConfig] = useState<EvaluationFormConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/evaluation/form")
      .then((res) => res.json())
      .then((data: { form: EvaluationFormConfig }) => {
        setFormConfig(data.form);
      })
      .catch(() => setError("Unable to load evaluation form."));
  }, []);

  if (error) {
    return (
      <div className="evaluation-page">
        <div className="evaluation-card">
          <h1 className="evaluation-card-title font-display">Event Evaluation</h1>
          <p className="evaluation-form-error mb-0" role="alert">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!formConfig) {
    return (
      <div className="evaluation-page">
        <div className="evaluation-card">
          <p className="evaluation-card-desc mb-0">Loading evaluation form...</p>
        </div>
      </div>
    );
  }

  return <EvaluationForm formConfig={formConfig} token={token} />;
}

export default function EvaluationPage() {
  return (
    <Suspense
      fallback={
        <div className="evaluation-page">
          <div className="evaluation-card">
            <p className="evaluation-card-desc mb-0">Loading evaluation form...</p>
          </div>
        </div>
      }
    >
      <EvaluationPageInner />
    </Suspense>
  );
}
