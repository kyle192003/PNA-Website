"use client";

import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { ConferenceEvent, EvaluationFormConfig, EvaluationQuestion } from "@/lib/types/admin";
import type { EvaluationStats } from "@/lib/evaluation-stats";
import { AdminBillInsights } from "@/components/admin/AdminBillInsights";
import { AdminExportMenu } from "@/components/admin/AdminExportMenu";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { PnaSelect } from "@/components/ui/PnaSelect";

const questionTypes: EvaluationQuestion["type"][] = ["rating", "text", "textarea", "select"];

export function EvaluationAdminPanel({ events }: { events: ConferenceEvent[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [form, setForm] = useState<EvaluationFormConfig | null>(null);
  const [stats, setStats] = useState<EvaluationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
    const res = await fetch(`/api/admin/evaluation${params}`);
    const data = await res.json();
    setForm(data.form ?? null);
    setStats(data.stats ?? null);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateQuestion(id: string, patch: Partial<EvaluationQuestion>) {
    if (!form) return;
    setForm({
      ...form,
      questions: form.questions.map((question) =>
        question.id === id ? { ...question, ...patch } : question
      ),
    });
  }

  function addQuestion() {
    if (!form) return;
    setForm({
      ...form,
      questions: [
        ...form.questions,
        {
          id: uuidv4(),
          label: "New question",
          type: "text",
          required: false,
        },
      ],
    });
  }

  function removeQuestion(id: string) {
    if (!form) return;
    setForm({
      ...form,
      questions: form.questions.filter((question) => question.id !== id),
    });
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/evaluation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save evaluation form.");
        return;
      }
      setForm(data.form);
      setMessage("Evaluation form saved.");
      await loadData();
    } catch {
      setError("Failed to save evaluation form.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page admin-evaluation-page">
      <LoadingOverlay show={loading || saving} scope="local" variant="form" />

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display">Evaluation</h1>
          <p className="admin-muted">
            Build the post-event evaluation form and review participant responses.
          </p>
        </div>
        <div className="admin-page-header-actions">
          <AdminExportMenu type="evaluation" eventId={eventId || null} />
        </div>
      </div>

      <div className="admin-evaluation-grid">
        {events.length === 0 ? (
          <section className="admin-card admin-participants-empty">
            <p className="admin-muted mb-0">Create an event first to review evaluation statistics.</p>
          </section>
        ) : (
        <section className="admin-card admin-evaluation-stats">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title font-display mb-1">Response Statistics</h2>
              <p className="admin-muted mb-0">Filter by event to review evaluation results.</p>
            </div>
            <PnaSelect
              className="admin-select"
              value={eventId}
              onChange={setEventId}
              options={events.map((event) => ({
                value: event.id,
                label: event.title,
              }))}
            />
          </div>

          {stats && (
            <>
              <AdminBillInsights
                title="Evaluation overview"
                subtitle="Response rates and rating summary for this event"
                highlightLabel="Response rate"
                highlightValue={`${stats.responseRate}%`}
                highlightHint={`${stats.totalResponses} of ${stats.totalInvites} invites`}
                metrics={[
                  { label: "Invites sent", value: stats.totalInvites },
                  { label: "Responses", value: stats.totalResponses },
                  {
                    label: "Average rating",
                    value: stats.averageRating ?? "N/A",
                  },
                  {
                    label: "Pending replies",
                    value: Math.max(stats.totalInvites - stats.totalResponses, 0),
                  },
                ]}
                chartTitle="Rating distribution"
                chartData={stats.ratingDistribution}
                chartMode="horizontal"
                breakdownTitle="Score summary"
                breakdown={stats.ratingDistribution.map((item) => ({
                  label: `${item.label} star${item.label === "1" ? "" : "s"}`,
                  value: String(item.value),
                }))}
              />

              {stats.questionBreakdown.map((question) => (
                <div key={question.questionId} className="admin-evaluation-question-stats">
                  <h3 className="admin-evaluation-subtitle">{question.label}</h3>
                  {question.answers.length > 0 ? (
                    question.answers.map((answer) => (
                      <div key={answer.label} className="admin-evaluation-bar-row">
                        <span>{answer.label}</span>
                        <div className="admin-evaluation-bar-track">
                          <div
                            className="admin-evaluation-bar-fill"
                            style={{
                              width: `${stats.totalResponses ? (answer.value / stats.totalResponses) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <strong>{answer.value}</strong>
                      </div>
                    ))
                  ) : (
                    <ul className="admin-evaluation-text-list">
                      {question.textResponses.length === 0 ? (
                        <li className="admin-muted">No responses yet.</li>
                      ) : (
                        question.textResponses.map((text, index) => <li key={index}>{text}</li>)
                      )}
                    </ul>
                  )}
                </div>
              ))}

              <div className="admin-evaluation-recent">
                <h3 className="admin-evaluation-subtitle">Recent responses</h3>
                {stats.recentResponses.length === 0 ? (
                  <p className="admin-muted mb-0">No evaluation submissions yet.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Reference</th>
                          <th>Rating</th>
                          <th>Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentResponses.map((response) => (
                          <tr key={response.id}>
                            <td>{response.name}</td>
                            <td>{response.referenceNumber}</td>
                            <td>{response.rating ?? "N/A"}</td>
                            <td>
                              {response.submittedAt
                                ? new Date(response.submittedAt).toLocaleString()
                                : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
        )}

        <section className="admin-card admin-evaluation-form-editor">
          <div className="admin-card-header">
            <div>
              <h2 className="admin-card-title font-display mb-1">Evaluation Form</h2>
              <p className="admin-muted mb-0">
                Participants answer this form from the evaluation email link.
              </p>
            </div>
          </div>

          {form && (
            <form className="admin-form" onSubmit={handleSave}>
              <label className="admin-label" htmlFor="eval-title">
                Form title
              </label>
              <input
                id="eval-title"
                className="admin-input mb-3"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />

              <label className="admin-label" htmlFor="eval-description">
                Description
              </label>
              <textarea
                id="eval-description"
                className="admin-input mb-3"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <div className="admin-evaluation-questions">
                {form.questions.map((question, index) => (
                  <div key={question.id} className="admin-evaluation-question-card">
                    <div className="admin-evaluation-question-head">
                      <strong>Question {index + 1}</strong>
                      <button
                        type="button"
                        className="admin-link-btn admin-link-btn--danger"
                        onClick={() => removeQuestion(question.id)}
                      >
                        Remove
                      </button>
                    </div>

                    <label className="admin-label">Label</label>
                    <input
                      className="admin-input mb-2"
                      value={question.label}
                      onChange={(e) => updateQuestion(question.id, { label: e.target.value })}
                    />

                    <label className="admin-label">Type</label>
                    <PnaSelect
                      className="admin-select mb-2"
                      value={question.type}
                      onChange={(next) =>
                        updateQuestion(question.id, {
                          type: next as EvaluationQuestion["type"],
                        })
                      }
                      options={questionTypes.map((type) => ({
                        value: type,
                        label: type,
                      }))}
                    />

                    {question.type === "select" && (
                      <>
                        <label className="admin-label">Options (one per line)</label>
                        <textarea
                          className="admin-input mb-2"
                          rows={3}
                          value={(question.options ?? []).join("\n")}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              options: e.target.value
                                .split("\n")
                                .map((line) => line.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      </>
                    )}

                    <label className="admin-check">
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(e) =>
                          updateQuestion(question.id, { required: e.target.checked })
                        }
                      />
                      Required
                    </label>
                  </div>
                ))}
              </div>

              <div className="admin-evaluation-form-actions">
                <button type="button" className="btn-pill-arrow btn-pill-arrow--outline" onClick={addQuestion}>
                  Add question
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save evaluation form"}
                </button>
              </div>

              {message && <p className="admin-alert admin-alert--success mt-3 mb-0">{message}</p>}
              {error && <p className="admin-alert admin-alert--error mt-3 mb-0">{error}</p>}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
