"use client";

import { useEffect, useState } from "react";
import type { CertificateTemplate, ConferenceEvent } from "@/lib/types/admin";
import { CertificateGeneratedPreview } from "@/components/admin/CertificateGeneratedPreview";
import { CertificateNamePlacementModal } from "@/components/admin/CertificateNamePlacementModal";
import { CertificateTemplateUpload } from "@/components/admin/CertificateTemplateUpload";
import { renderCertificateTemplatePreview } from "@/lib/certificate-template-preview";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { PnaSelect } from "@/components/ui/PnaSelect";

function withCacheBust(url: string, version?: string): string {
  if (!url) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(version ?? String(Date.now()))}`;
}

type CertificateTemplatePanelProps = {
  eventId?: string;
  events?: ConferenceEvent[];
  embedded?: boolean;
};

export function CertificateTemplatePanel({
  eventId: fixedEventId,
  events = [],
  embedded = false,
}: CertificateTemplatePanelProps) {
  const [selectedEventId, setSelectedEventId] = useState(
    fixedEventId ?? events[0]?.id ?? ""
  );
  const eventId = fixedEventId ?? selectedEventId;

  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [defaultTemplate, setDefaultTemplate] = useState<CertificateTemplate | null>(null);
  const [previewImage, setPreviewImage] = useState("");
  const [previewPdf, setPreviewPdf] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [templatePreview, setTemplatePreview] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null);
  const [pendingFileType, setPendingFileType] = useState<"image" | "pdf">("image");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function withEventId(payload: object = {}) {
    return eventId ? { ...payload, eventId } : payload;
  }

  function certificatesUrl(path = "/api/admin/certificates") {
    if (!eventId) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}eventId=${encodeURIComponent(eventId)}`;
  }

  async function loadTemplatePreview(current: CertificateTemplate | null) {
    if (!current?.imageUrl) {
      setTemplatePreview("");
      return;
    }

    try {
      const preview = await renderCertificateTemplatePreview(
        withCacheBust(current.imageUrl, current.updatedAt),
        current.fileType
      );
      setTemplatePreview(preview);
    } catch {
      setTemplatePreview("");
    }
  }

  async function loadTemplate() {
    if (!eventId && !embedded) {
      setTemplate(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    const res = await fetch(certificatesUrl());
    const data = await res.json();
    setTemplate(data.template ?? null);
    setPlaceholders(data.placeholders ?? []);
    setDefaultTemplate(data.defaultTemplate ?? null);
    setLoading(false);
    await loadTemplatePreview(data.template ?? null);
    await refreshPreview(data.template ?? null);
  }

  async function refreshPreview(nextTemplate?: CertificateTemplate | null) {
    const current = nextTemplate ?? template;
    if (!current?.imageUrl) {
      setPreviewImage("");
      setPreviewPdf("");
      setPreviewSubject(current?.subject ?? "");
      return;
    }

    const res = await fetch("/api/admin/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        withEventId({
          action: "preview",
          ...current,
        })
      ),
    });
    const data = await res.json();
    if (res.ok) {
      setPreviewImage(data.preview?.imageDataUrl ?? "");
      setPreviewPdf(data.preview?.pdfDataUrl ?? "");
      setPreviewSubject(data.preview?.subject ?? "");
    } else {
      setPreviewImage("");
      setPreviewPdf("");
      setError(data.error ?? "Failed to generate certificate preview.");
    }
  }

  async function persistTemplate(next: CertificateTemplate) {
    const res = await fetch("/api/admin/certificates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withEventId(next)),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to save certificate template.");
    }
    setTemplate(data.template);
    await loadTemplatePreview(data.template);
    await refreshPreview(data.template);
    return data.template as CertificateTemplate;
  }

  useEffect(() => {
    if (fixedEventId) {
      setSelectedEventId(fixedEventId);
      return;
    }
    if (!selectedEventId && events[0]?.id) {
      setSelectedEventId(events[0].id);
    }
  }, [fixedEventId, events, selectedEventId]);

  useEffect(() => {
    void loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!template) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await persistTemplate(template);
      setMessage("Certificate template saved for this event.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save certificate template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTemplateUpload(file: File) {
    setUploadingTemplate(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      if (eventId) formData.set("eventId", eventId);

      const res = await fetch("/api/admin/certificates/image", {
        method: "POST",
        body: formData,
      });

      let data: {
        template?: CertificateTemplate;
        fileUrl?: string;
        fileType?: "image" | "pdf";
        imageUrl?: string;
        error?: string;
      } = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.ok
            ? "Upload succeeded but the server returned an invalid response."
            : `Upload failed (${res.status}). Check your connection and try again.`
        );
      }

      if (!res.ok) {
        setError(data.error ?? `Upload failed (${res.status}).`);
        return;
      }

      if (!data.template?.imageUrl) {
        setError("Upload completed but no template file URL was returned.");
        return;
      }

      const fileType = data.fileType ?? data.template.fileType ?? "image";
      const fileUrl = data.fileUrl ?? data.template.imageUrl;

      setTemplate(data.template);
      setPendingFileUrl(fileUrl);
      setPendingFileType(fileType);
      setPlacementOpen(true);
      await loadTemplatePreview(data.template);
      setMessage("Template uploaded. Drag the name box to the correct area, then save placement.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload certificate template.");
    } finally {
      setUploadingTemplate(false);
    }
  }

  async function handlePlacementConfirm(
    placement: Pick<
      CertificateTemplate,
      | "namePosXPercent"
      | "namePosYPercent"
      | "nameWidthPercent"
      | "nameHeightPercent"
      | "nameColor"
      | "nameFontWeight"
    >
  ) {
    if (!template) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const next = { ...template, ...placement };
      await persistTemplate(next);
      setPlacementOpen(false);
      setPendingFileUrl(null);
      setMessage("Name placement saved. Certificates will be generated as PDF automatically.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save name placement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    if (!testEmail.trim()) {
      setError("Enter a test email address.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withEventId({ action: "test-email", email: testEmail.trim() })
        ),
      });

      let data: { message?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.ok
            ? "Test email sent, but the server response was invalid."
            : `Test email failed (${res.status}). Check SMTP settings in .env.`
        );
      }

      if (!res.ok) {
        setError(data.error ?? `Test email failed (${res.status}).`);
        return;
      }
      setMessage(data.message ?? "Test certificate email sent with PDF attached.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test email.");
    } finally {
      setSaving(false);
    }
  }

  const placementFileUrl = pendingFileUrl ?? template?.imageUrl ?? "";
  const placementFileType = pendingFileUrl ? pendingFileType : (template?.fileType ?? "image");
  const placementFileSrc = placementFileUrl
    ? withCacheBust(placementFileUrl, template?.updatedAt)
    : "";
  const selectedEventTitle =
    events.find((event) => event.id === eventId)?.title ?? "this event";

  const editor = (
    <>
      <LoadingOverlay show={loading || saving || uploadingTemplate} scope="local" variant="form" />

      <CertificateNamePlacementModal
        open={placementOpen && Boolean(placementFileSrc)}
        fileUrl={placementFileSrc}
        fileType={placementFileType}
        initial={
          template ?? {
            namePosXPercent: 50,
            namePosYPercent: 45,
            nameWidthPercent: 66,
            nameHeightPercent: 10,
            nameColor: "#ffffff",
            nameFontWeight: 700,
          }
        }
        onClose={() => {
          setPlacementOpen(false);
          setPendingFileUrl(null);
        }}
        onConfirm={(placement) => void handlePlacementConfirm(placement)}
      />

      {!embedded && (
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title font-display">Certificate Templates</h1>
            <p className="admin-muted">
              Each event has its own certificate. Upload a blank image or PDF, place the name box,
              and certificates are emailed as PDF attachments after evaluation.
            </p>
          </div>
        </div>
      )}

      {!eventId ? (
        <section className="admin-card">
          <p className="admin-muted mb-0">
            Create an event first, then upload a certificate template for that event.
          </p>
        </section>
      ) : (
        <div className="admin-certificates-grid">
          <section className={`admin-card admin-certificates-editor${embedded ? " admin-certificates-editor--embedded" : ""}`}>
            {!embedded && events.length > 0 && (
              <div className="admin-card-header mb-3">
                <div>
                  <h2 className="admin-card-title font-display mb-1">Event certificate</h2>
                  <p className="admin-muted mb-0">
                    Templates are saved per event so each conference can use a different design.
                  </p>
                </div>
                <PnaSelect
                  className="admin-select"
                  value={eventId}
                  onChange={setSelectedEventId}
                  options={events.map((event) => ({
                    value: event.id,
                    label: event.title,
                  }))}
                />
              </div>
            )}

            {template && (
              <form className="admin-form" onSubmit={handleSave}>
                <label className="admin-label" htmlFor="cert-subject">
                  Email subject
                </label>
                <input
                  id="cert-subject"
                  className="admin-input mb-3"
                  value={template.subject}
                  onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                />

                <CertificateTemplateUpload
                  disabled={uploadingTemplate || saving}
                  onUpload={handleTemplateUpload}
                />

                {template.imageUrl && (
                  <div className="admin-certificates-template-status mb-3">
                    <span className="admin-certificates-template-badge">
                      {template.fileType === "pdf" ? "PDF template" : "Image template"}
                    </span>
                    {templatePreview ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={templatePreview}
                        alt={`Certificate template for ${selectedEventTitle}`}
                        className="admin-certificates-image-preview-img mt-2"
                      />
                    ) : template.fileType === "pdf" ? (
                      <p className="admin-muted mb-0 mt-2">
                        PDF uploaded. Open placement to position the name area.
                      </p>
                    ) : null}
                  </div>
                )}

                {template.imageUrl && (
                  <button
                    type="button"
                    className="btn-pill-arrow btn-pill-arrow--outline mb-3"
                    onClick={() => {
                      setPendingFileUrl(null);
                      setPendingFileType(template.fileType);
                      setPlacementOpen(true);
                    }}
                  >
                    Adjust name placement
                  </button>
                )}

                <div className="admin-certificates-placeholders">
                  <p className="admin-label mb-1">Available placeholders (email subject)</p>
                  <div className="admin-certificates-placeholder-list">
                    {placeholders.map((placeholder) => (
                      <code key={placeholder}>{placeholder}</code>
                    ))}
                  </div>
                </div>

                <div className="admin-certificates-actions">
                  <button
                    type="button"
                    className="btn-pill-arrow btn-pill-arrow--outline"
                    onClick={() => defaultTemplate && setTemplate(defaultTemplate)}
                  >
                    Reset to default
                  </button>
                  <button
                    type="button"
                    className="btn-pill-arrow btn-pill-arrow--outline"
                    onClick={() => void refreshPreview()}
                  >
                    Refresh preview
                  </button>
                  <button type="submit" className="btn-primary">
                    Save template
                  </button>
                </div>

                <div className="admin-certificates-test mt-3">
                  <label className="admin-label" htmlFor="cert-test-email">
                    Send test certificate email (PDF attachment)
                  </label>
                  <div className="admin-certificates-test-row">
                    <input
                      id="cert-test-email"
                      type="email"
                      className="admin-input"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                    <button
                      type="button"
                      className="btn-pill-arrow"
                      onClick={() => void handleTestEmail()}
                    >
                      Send test
                    </button>
                  </div>
                </div>

                {message && <p className="admin-alert admin-alert--success mt-3 mb-0">{message}</p>}
                {error && <p className="admin-alert admin-alert--error mt-3 mb-0">{error}</p>}
              </form>
            )}
          </section>

          <section className="admin-card admin-certificates-preview">
            <div className="admin-card-header">
              <div>
                <h2 className="admin-card-title font-display mb-1">PDF Preview</h2>
                <p className="admin-muted mb-0">{previewSubject || "Certificate preview"}</p>
              </div>
            </div>
            <div className="admin-certificates-preview-body">
              <CertificateGeneratedPreview imageDataUrl={previewImage} pdfDataUrl={previewPdf} />
            </div>
          </section>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="admin-certificates-embedded">{editor}</div>;
  }

  return <div className="admin-page admin-certificates-page">{editor}</div>;
}
