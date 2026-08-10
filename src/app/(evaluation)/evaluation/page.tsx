"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EvaluationFormConfig } from "@/lib/types/admin";
import { EvaluationForm } from "@/components/EvaluationForm";
import { conference } from "@/lib/conference";

type TokenStatus = {
  alreadySubmitted: boolean;
  name: string;
};

function EvaluationPageInner() {
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get("t") ?? searchParams.get("token") ?? "",
    [searchParams]
  );
  const [formConfig, setFormConfig] = useState<EvaluationFormConfig | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setTokenStatus(null);

      if (!token.trim()) {
        if (!cancelled) {
          setError(
            "Missing or invalid evaluation link. Please use the link sent in your email."
          );
          setFormConfig(null);
          setTokenStatus(null);
          setLoading(false);
        }
        return;
      }

      try {
        const validateRes = await fetch(
          `/api/evaluation/validate?t=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const validateData = (await validateRes.json()) as {
          error?: string;
          alreadySubmitted?: boolean;
          name?: string;
        };

        if (!validateRes.ok) {
          throw new Error(
            validateData.error ??
              "Missing or invalid evaluation link. Please use the link sent in your email."
          );
        }

        const formRes = await fetch("/api/evaluation/form");
        const formData = (await formRes.json()) as { form?: EvaluationFormConfig };
        if (!formRes.ok || !formData.form) {
          throw new Error("Unable to load evaluation form.");
        }

        if (cancelled) return;
        setTokenStatus({
          alreadySubmitted: Boolean(validateData.alreadySubmitted),
          name: validateData.name ?? "",
        });
        setFormConfig(formData.form);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load evaluation form.");
          setFormConfig(null);
          setTokenStatus(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="evaluation-page">
        <div className="evaluation-card">
          <p className="evaluation-card-desc mb-0">Loading evaluation form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="evaluation-page">
        <div className="evaluation-card">
          <h1 className="evaluation-card-title font-display">Event Evaluation</h1>
          <p className="evaluation-form-error" role="alert">
            {error}
          </p>
          <p className="evaluation-card-desc mb-0">
            Contact the secretariat at{" "}
            <a href={`mailto:${conference.contact.registrationEmail}`}>
              {conference.contact.registrationEmail}
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  if (!formConfig || !tokenStatus) {
    return null;
  }

  if (tokenStatus.alreadySubmitted) {
    return (
      <div className="evaluation-page">
        <div className="evaluation-card">
          <h1 className="evaluation-card-title font-display">{formConfig.title}</h1>
          <p className="evaluation-card-done mb-0">
            {tokenStatus.name ? `Thank you, ${tokenStatus.name}. ` : ""}
            You have already submitted this evaluation. You can close this page.
          </p>
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
