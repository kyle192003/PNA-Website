"use client";

import { useCallback, useRef, useState } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  tagline?: string;
  confirmLabel?: string;
  variant?: "default" | "danger";
  loadingMessage?: string;
  successTitle?: string;
  successMessage?: string;
  showSuccess?: boolean;
  errorTitle?: string;
  onSuccessClose?: () => void;
  /** Return a string to override the success dialog message. */
  action: () => Promise<void | string>;
}

const initialConfirmState = {
  open: false,
  title: "",
  message: "",
  tagline: "",
  confirmLabel: "Yes, continue",
  variant: "default" as "default" | "danger",
  loadingMessage: "Processing...",
  successTitle: "",
  successMessage: "",
  showSuccess: true,
  errorTitle: "Something went wrong",
  action: null as (() => Promise<void | string>) | null,
};

const initialSuccessState = {
  open: false,
  title: "",
  message: "",
};

const initialErrorState = {
  open: false,
  title: "",
  message: "",
};

export function useConfirmAction() {
  const [confirm, setConfirm] = useState(initialConfirmState);
  const [success, setSuccess] = useState(initialSuccessState);
  const [error, setError] = useState(initialErrorState);
  const [loading, setLoading] = useState(false);
  const onSuccessCloseRef = useRef<(() => void) | null>(null);

  const requestConfirm = useCallback((options: ConfirmOptions) => {
    onSuccessCloseRef.current = options.onSuccessClose ?? null;
    setError(initialErrorState);
    setConfirm({
      open: true,
      title: options.title,
      message: options.message,
      tagline: options.tagline ?? "",
      confirmLabel: options.confirmLabel ?? "Yes, continue",
      variant: options.variant ?? "default",
      loadingMessage: options.loadingMessage ?? "Processing...",
      successTitle: options.successTitle ?? "Success",
      successMessage: options.successMessage ?? "Completed successfully.",
      showSuccess: options.showSuccess !== false,
      errorTitle: options.errorTitle ?? "Something went wrong",
      action: options.action,
    });
  }, []);

  const cancelConfirm = useCallback(() => {
    if (loading) return;
    onSuccessCloseRef.current = null;
    setConfirm(initialConfirmState);
  }, [loading]);

  const dismissSuccess = useCallback(() => {
    setSuccess(initialSuccessState);
    const onSuccessClose = onSuccessCloseRef.current;
    onSuccessCloseRef.current = null;
    onSuccessClose?.();
  }, []);

  const dismissError = useCallback(() => {
    setError(initialErrorState);
  }, []);

  const confirmAction = useCallback(async () => {
    if (!confirm.action || loading) return;

    const { action, successTitle, successMessage, showSuccess, errorTitle } = confirm;

    setLoading(true);
    try {
      const result = await action();
      setConfirm(initialConfirmState);
      if (showSuccess) {
        setSuccess({
          open: true,
          title: successTitle,
          message:
            typeof result === "string" && result.trim() ? result.trim() : successMessage,
        });
      }
    } catch (err) {
      setConfirm(initialConfirmState);
      setError({
        open: true,
        title: errorTitle,
        message:
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [confirm, loading]);

  return {
    confirm,
    success,
    error,
    loading,
    loadingMessage: confirm.loadingMessage,
    requestConfirm,
    cancelConfirm,
    dismissSuccess,
    dismissError,
    confirmAction,
  };
}
