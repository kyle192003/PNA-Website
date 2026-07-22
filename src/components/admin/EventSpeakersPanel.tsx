"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ConferenceEvent, EventSpeaker } from "@/lib/types/admin";
import { getSpeakerInitials } from "@/lib/speaker-utils";
import { ActionConfirmDialogs } from "@/components/ui/ActionConfirmDialogs";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useConfirmAction } from "@/hooks/use-confirm-action";

type SpeakerFormState = {
  name: string;
  title: string;
  organization: string;
};

const emptyForm: SpeakerFormState = {
  name: "",
  title: "",
  organization: "",
};

function speakerToForm(speaker: EventSpeaker): SpeakerFormState {
  return {
    name: speaker.name,
    title: speaker.title,
    organization: speaker.organization,
  };
}

export function EventSpeakersPanel({
  event,
  onUpdated,
}: {
  event: ConferenceEvent;
  onUpdated: (event: ConferenceEvent) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmHook = useConfirmAction();
  const { loading, requestConfirm } = confirmHook;
  const [form, setForm] = useState<SpeakerFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  function updateField(field: keyof SpeakerFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setCurrentImageUrl(null);
    if (photoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    formRef.current?.reset();
  }

  function startEdit(speaker: EventSpeaker) {
    setEditingId(speaker.id);
    setForm(speakerToForm(speaker));
    setCurrentImageUrl(speaker.imageUrl);
    if (photoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(speaker.imageUrl);
    setError("");
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (photoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoPreview(URL.createObjectURL(file));
  }

  async function saveSpeaker() {
    if (!form.name.trim()) return;

    const formElement = formRef.current;
    if (!formElement) return;

    const formData = new FormData(formElement);
    formData.set("name", form.name.trim());
    formData.set("title", form.title.trim());
    formData.set("organization", form.organization.trim());

    const endpoint = editingId
      ? `/api/admin/events/${event.id}/speakers/${editingId}`
      : `/api/admin/events/${event.id}/speakers`;

    const res = await fetch(endpoint, {
      method: editingId ? "PATCH" : "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to save speaker.");

    onUpdated(data.event);
    resetForm();
  }

  function handleSubmit(submitEvent: React.FormEvent) {
    submitEvent.preventDefault();
    setError("");

    requestConfirm({
      title: editingId ? "Save speaker changes?" : "Add speaker?",
      message: editingId
        ? "Are you sure you want to save these speaker details?"
        : "Are you sure you want to add this speaker to the event?",
      confirmLabel: editingId ? "Save speaker" : "Add speaker",
      loadingMessage: editingId ? "Saving speaker..." : "Adding speaker...",
      successTitle: editingId ? "Speaker updated" : "Speaker added",
      successMessage: editingId
        ? "The speaker details were updated successfully."
        : "The speaker was added to this event.",
      action: saveSpeaker,
    });
  }

  function handleDelete(speaker: EventSpeaker) {
    requestConfirm({
      title: "Delete speaker?",
      message: `Are you sure you want to remove ${speaker.name} from this event?`,
      confirmLabel: "Delete speaker",
      variant: "danger",
      loadingMessage: "Deleting speaker...",
      successTitle: "Speaker deleted",
      successMessage: "The speaker was removed from this event.",
      action: async () => {
        const res = await fetch(`/api/admin/events/${event.id}/speakers/${speaker.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to delete speaker.");
        onUpdated(data.event);
        if (editingId === speaker.id) resetForm();
      },
    });
  }

  return (
    <div className="admin-card admin-speakers-panel">
      <LoadingOverlay show={loading} scope="local" variant="form" />
      <ActionConfirmDialogs hook={confirmHook} />

      <div className="admin-card-header">
        <div>
          <h2 className="admin-card-title font-display">Event Speakers</h2>
          <p className="admin-card-desc mb-0">
            Manage speakers and upload portrait photos for the event overview page.
          </p>
        </div>
      </div>

      <div className="admin-speakers-panel-body">
        <form ref={formRef} className="admin-speakers-form" onSubmit={handleSubmit}>
          {error && <div className="admin-alert admin-alert--error">{error}</div>}

          <div className="admin-speakers-form-grid">
            <label className="admin-label">
              Name
              <input
                className="admin-input"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Hon. Maria Elena Santos"
                required
                disabled={loading}
              />
            </label>
            <label className="admin-label">
              Title
              <input
                className="admin-input"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Secretary"
                disabled={loading}
              />
            </label>
            <label className="admin-label admin-speakers-form-grid--wide">
              Organization
              <input
                className="admin-input"
                value={form.organization}
                onChange={(e) => updateField("organization", e.target.value)}
                placeholder="Department or institution"
                disabled={loading}
              />
            </label>
            <label className="admin-label admin-speakers-form-grid--wide">
              Portrait Photo
              <input
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="admin-input"
                onChange={handlePhotoChange}
                disabled={loading}
              />
            </label>
          </div>

          {photoPreview && (
            <div className="admin-speaker-photo-preview">
              <Image
                src={photoPreview}
                alt="Speaker portrait preview"
                width={160}
                height={200}
                className="admin-speaker-photo-preview-image"
                unoptimized={photoPreview.startsWith("blob:")}
              />
              {currentImageUrl && !photoPreview.startsWith("blob:") && (
                <p className="admin-muted mb-0">Current uploaded photo</p>
              )}
            </div>
          )}

          <div className="admin-speakers-form-actions">
            {editingId && (
              <button type="button" className="admin-link-btn" onClick={resetForm} disabled={loading}>
                Cancel Edit
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={loading}>
              {editingId ? "Save Speaker" : "Add Speaker"}
            </button>
          </div>
        </form>

        {event.speakers.length === 0 ? (
          <p className="admin-muted mb-0">No speakers added for this event yet.</p>
        ) : (
          <div className="admin-speakers-list">
            {event.speakers.map((speaker) => (
              <article
                key={speaker.id}
                className={`admin-speaker-item ${editingId === speaker.id ? "active" : ""}`}
              >
                <div className="admin-speaker-item-main">
                  {speaker.imageUrl ? (
                    <Image
                      src={speaker.imageUrl}
                      alt={speaker.name}
                      width={56}
                      height={70}
                      className="admin-speaker-item-photo"
                    />
                  ) : (
                    <div className="admin-speaker-item-photo admin-speaker-item-photo--placeholder font-display">
                      {getSpeakerInitials(speaker.name)}
                    </div>
                  )}
                  <div>
                    <p className="admin-speaker-item-name">{speaker.name}</p>
                    <p className="admin-speaker-item-meta">
                      {[speaker.title, speaker.organization].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="admin-speaker-item-actions">
                  <button
                    type="button"
                    className="admin-link-btn"
                    onClick={() => startEdit(speaker)}
                    disabled={loading}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-link-btn admin-link-btn--danger"
                    onClick={() => handleDelete(speaker)}
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
