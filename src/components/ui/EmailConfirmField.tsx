"use client";

import { useId, useState } from "react";
import {
  applyEmailDomain,
  getEmailConfirmationError,
  getSuggestedEmailDomain,
} from "@/lib/email-domain";
import { isValidEmail } from "@/lib/form-validation";

const EMAIL_VALIDITY_NOTE =
  "Please ensure that you enter a VALID AND WORKING EMAIL ADDRESS. All reference numbers and confirmation emails shall be sent through the email address you used to register.";

function ConfirmEmailInput({
  id,
  value,
  onChange,
  error,
  className,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  className: string;
  describedBy?: string;
}) {
  return (
    <input
      id={id}
      name={`${id}-manual`}
      type="text"
      inputMode="text"
      value={value}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      readOnly
      placeholder="Retype your email"
      data-lpignore="true"
      data-1p-ignore="true"
      data-bwignore="true"
      data-form-type="other"
      aria-invalid={Boolean(error)}
      aria-describedby={describedBy}
      onFocus={(event) => event.currentTarget.removeAttribute("readonly")}
      onPaste={(event) => event.preventDefault()}
      onDrop={(event) => event.preventDefault()}
      onCopy={(event) => event.preventDefault()}
      onCut={(event) => event.preventDefault()}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
}

export function EmailConfirmField({
  label,
  id,
  value,
  onChange,
  confirmValue,
  onConfirmChange,
  onBlur,
  error,
  required = false,
  optional = false,
  placeholder,
  disabled = false,
  className = "col-12 col-md-6",
  variant = "registration",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  confirmValue: string;
  onConfirmChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: "registration" | "contact";
}) {
  const suggestionId = useId();
  const noteId = useId();
  const confirmId = `${id}-confirm`;
  const [emailFocused, setEmailFocused] = useState(false);
  const suggestion = getSuggestedEmailDomain(value);
  const showConfirm = !disabled && isValidEmail(value) && !suggestion;
  const showValidityNote =
    variant === "registration" &&
    !disabled &&
    emailFocused &&
    value.trim().length > 0 &&
    !suggestion &&
    !showConfirm;
  const domainError = Boolean(error && !showConfirm);
  const confirmMismatch =
    showConfirm && confirmValue.trim()
      ? getEmailConfirmationError(value, confirmValue)
      : null;
  const confirmError = showConfirm ? error || confirmMismatch : null;
  const mainError = domainError ? error : undefined;

  function handleEmailChange(next: string) {
    onChange(next);
    if (confirmValue) onConfirmChange("");
  }

  function applySuggestion() {
    if (!suggestion) return;
    const next = applyEmailDomain(value, suggestion);
    onChange(next);
    onConfirmChange("");
  }

  function emailDescribedBy() {
    if (suggestion) return suggestionId;
    if (showValidityNote) return noteId;
    if (mainError) return `${id}-error`;
    return undefined;
  }

  if (variant === "contact") {
    return (
      <div className={`contact-field${mainError || confirmError ? " contact-field--error" : ""}`}>
        <label htmlFor={id} className="contact-field-label">
          {label}
          {required ? <span className="contact-field-required">*</span> : null}
        </label>
        <div className="email-confirm-wrap">
          <input
            id={id}
            type="email"
            required={required}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="email"
            spellCheck={false}
            aria-invalid={Boolean(mainError)}
            aria-describedby={emailDescribedBy()}
            onChange={(event) => handleEmailChange(event.target.value)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => {
              setEmailFocused(false);
              onBlur?.();
            }}
            className={`contact-field-control${mainError ? " contact-field-control--error" : ""}`}
          />
          {suggestion ? (
            <div id={suggestionId} className="email-confirm-panel" role="note">
              <button type="button" className="email-confirm-suggestion" onClick={applySuggestion}>
                You mean @{suggestion}?
              </button>
            </div>
          ) : null}
          {showConfirm ? (
            <div className="email-confirm-panel" role="group" aria-label="Confirm email address">
              <label htmlFor={confirmId} className="email-confirm-label">
                Retype email to confirm
              </label>
              <ConfirmEmailInput
                id={confirmId}
                value={confirmValue}
                onChange={onConfirmChange}
                error={confirmError}
                describedBy={confirmError ? `${confirmId}-error` : undefined}
                className={`contact-field-control${confirmError ? " contact-field-control--error" : ""}`}
              />
              {confirmError ? (
                <p id={`${confirmId}-error`} className="email-confirm-panel-error" role="alert">
                  {confirmError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {mainError ? (
          <p id={`${id}-error`} className="contact-field-error" role="alert">
            {mainError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`registration-form-field registration-email-field ${className}`.trim()}>
      <label htmlFor={id} className="form-label registration-form-label">
        {label}{" "}
        {required ? <span className="text-accent">*</span> : null}
        {optional ? <span className="registration-form-optional"> (Optional)</span> : null}
      </label>
      <div className="email-confirm-wrap">
        <input
          type="email"
          id={id}
          value={value}
          onChange={(e) => handleEmailChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="email"
          spellCheck={false}
          aria-invalid={Boolean(mainError)}
          aria-describedby={emailDescribedBy()}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => {
            setEmailFocused(false);
            onBlur?.();
          }}
          className={`input-dark ${mainError ? "input-dark-error" : ""}`}
        />
        {showValidityNote ? (
          <div id={noteId} className="email-validity-note" role="note">
            <p className="email-validity-note-text">{EMAIL_VALIDITY_NOTE}</p>
          </div>
        ) : null}
        {suggestion ? (
          <div id={suggestionId} className="email-confirm-panel" role="note">
            <button type="button" className="email-confirm-suggestion" onClick={applySuggestion}>
              You mean @{suggestion}?
            </button>
          </div>
        ) : null}
        {showConfirm ? (
          <div className="email-confirm-panel" role="group" aria-label="Confirm email address">
            <label htmlFor={confirmId} className="email-confirm-label">
              Retype email to confirm
            </label>
            <ConfirmEmailInput
              id={confirmId}
              value={confirmValue}
              onChange={onConfirmChange}
              error={confirmError}
              className={`input-dark ${confirmError ? "input-dark-error" : ""}`}
            />
            {confirmError ? (
              <p id={`${confirmId}-error`} className="email-confirm-panel-error">
                {confirmError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {mainError ? (
        <p id={`${id}-error`} className="registration-field-error">
          {mainError}
        </p>
      ) : null}
    </div>
  );
}
