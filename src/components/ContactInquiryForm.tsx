"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  validateContactInquiry,
  type ContactInquiryFieldErrors,
  type ContactInquiryFormData,
} from "@/lib/form-validation";

const emptyForm: ContactInquiryFormData = {
  name: "",
  email: "",
  mobile: "",
  message: "",
};

export function ContactInquiryForm() {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<ContactInquiryFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function updateField<K extends keyof ContactInquiryFormData>(
    field: K,
    value: ContactInquiryFormData[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
    if (error) setError("");
  }

  function validateForm(): boolean {
    const nextErrors = validateContactInquiry(form);
    setErrors(nextErrors);
    const invalid = Object.keys(nextErrors) as Array<keyof ContactInquiryFieldErrors>;
    if (invalid.length === 0) return true;

    const firstId =
      invalid[0] === "name"
        ? "contact-name"
        : invalid[0] === "email"
          ? "contact-email"
          : invalid[0] === "mobile"
            ? "contact-mobile"
            : "contact-message";
    window.requestAnimationFrame(() => {
      document.getElementById(firstId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(firstId)?.focus();
    });
    return false;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSuccess(false);
    setError("");

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Unable to submit your inquiry. Please try again.");
        return;
      }

      setForm(emptyForm);
      setErrors({});
      setSuccess(true);
    } catch {
      setError("Unable to submit your inquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      {success && (
        <p className="contact-form-success" role="status">
          Thank you for reaching out. Your inquiry has been received and our team will get back to you
          soon.
        </p>
      )}

      {error && (
        <p className="contact-form-error" role="alert">
          {error}
        </p>
      )}

      <ContactField
        id="contact-name"
        label="Full Name"
        required
        value={form.name}
        onChange={(value) => updateField("name", value)}
        error={errors.name}
        disabled={submitting}
      />
      <ContactField
        id="contact-email"
        label="E-mail ID"
        type="email"
        required
        value={form.email}
        onChange={(value) => updateField("email", value)}
        error={errors.email}
        disabled={submitting}
      />
      <ContactField
        id="contact-mobile"
        label="Mobile No."
        type="tel"
        required
        placeholder="+63 9XX XXX XXXX"
        value={form.mobile}
        onChange={(value) => updateField("mobile", value)}
        error={errors.mobile}
        disabled={submitting}
      />
      <ContactField
        id="contact-message"
        label="Message"
        required
        multiline
        value={form.message}
        onChange={(value) => updateField("message", value)}
        error={errors.message}
        disabled={submitting}
      />

      <button type="submit" className="contact-submit-btn" disabled={submitting}>
        {submitting ? "Submitting..." : "Submit"}
      </button>

      <p className="contact-form-note">
        Looking for events to join?{" "}
        <Link href="/events" className="contact-form-note-link">
          click here
        </Link>
        .
      </p>
    </form>
  );
}

function ContactField({
  id,
  label,
  value,
  onChange,
  required = false,
  type = "text",
  multiline = false,
  disabled = false,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  multiline?: boolean;
  disabled?: boolean;
  placeholder?: string;
  error?: string;
}) {
  const controlClassName = `contact-field-control${error ? " contact-field-control--error" : ""}`;

  return (
    <div className={`contact-field${error ? " contact-field--error" : ""}`}>
      <label htmlFor={id} className="contact-field-label">
        {label}
        {required && <span className="contact-field-required">*</span>}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          required={required}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={controlClassName}
        />
      ) : (
        <input
          id={id}
          type={type}
          required={required}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={controlClassName}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="contact-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
